import { Op } from 'sequelize';
import { body } from 'express-validator';
import { Household, PickupLog, User, Ward } from '../models/index.js';
import { collectValidationErrors } from '../middleware/validate.js';
import { scopedWardId } from '../utils/access.js';
import HttpError from '../utils/HttpError.js';
import { createPickup } from '../services/pickupService.js';

export const pickupFields = [
  body('clientUuid').isUUID().withMessage('clientUuid must be a UUID.'),
  body('qrCode').isString().trim().notEmpty().withMessage('qrCode is required.'),
  body('status').isIn(['segregated', 'mixed', 'rejected']).withMessage('Invalid pickup status.'),
  body('reason').optional().isString().trim().isLength({ max: 255 }).withMessage('Reason must be at most 255 characters.'),
  body('reason').custom((reason, { req }) => req.body.status !== 'rejected' || (typeof reason === 'string' && reason.trim().length > 0))
    .withMessage('A reason is required when status is rejected.'),
  body('note').optional().isString().isLength({ max: 2000 }).withMessage('Note must be at most 2000 characters.'),
  body('loggedAt').optional().isISO8601().withMessage('loggedAt must be an ISO 8601 date.')
    .bail()
    .custom((value) => {
      const timestamp = new Date(value).getTime();
      const now = Date.now();
      return timestamp <= now + 5 * 60 * 1000 && timestamp >= now - 7 * 24 * 60 * 60 * 1000;
    })
    .withMessage('loggedAt must not be over 5 minutes in the future or older than 7 days.'),
];

export async function createPickupLog(request, response) {
  const result = await createPickup(request.body, request.user);
  if (result.duplicate) {
    response.status(200).json({ log: result.log, duplicate: true });
    return;
  }
  response.status(201).json({
    log: result.log,
    pointsAwarded: result.pointsAwarded,
    ecoPointsTotal: result.ecoPointsTotal,
    notification: result.notification,
  });
}

export async function createPickupBatch(request, response) {
  const results = new Array(request.body.logs.length);
  const ordered = request.body.logs
    .map((input, index) => ({
      input,
      index,
      sortTime: new Date(input?.loggedAt || Date.now()).getTime(),
    }))
    .sort((first, second) => first.sortTime - second.sortTime || first.index - second.index);

  for (const item of ordered) {
    if (!item.input || typeof item.input !== 'object' || Array.isArray(item.input)) {
      results[item.index] = {
        result: 'failed',
        error: { message: 'Each log must be a JSON object.' },
      };
      continue;
    }
    const requestForValidation = { body: item.input, query: {}, params: {} };
    const validationDetails = await collectValidationErrors(requestForValidation, pickupFields);
    if (validationDetails.length) {
      results[item.index] = {
        clientUuid: item.input?.clientUuid,
        result: 'failed',
        error: { message: 'Validation failed.', details: validationDetails },
      };
      continue;
    }

    try {
      const result = await createPickup(item.input, request.user);
      results[item.index] = {
        clientUuid: item.input.clientUuid,
        result: result.duplicate ? 'duplicate' : 'created',
      };
    } catch (error) {
      results[item.index] = {
        clientUuid: item.input?.clientUuid,
        result: 'failed',
        error: { message: error.message, ...(error.details ? { details: error.details } : {}) },
      };
    }
  }

  response.status(200).json({ results });
}

export async function listPickupLogs(request, response) {
  const { wardId: requestedWardId, householdId, status, from, to, page = 1, limit = 20 } = request.query;
  const wardId = scopedWardId(request.user, requestedWardId);
  const where = {};
  if (householdId) where.householdId = Number(householdId);
  if (status) where.status = status;
  if (from || to) {
    where.loggedAt = {};
    if (from) where.loggedAt[Op.gte] = new Date(from);
    if (to) where.loggedAt[Op.lte] = new Date(to);
  }
  if (request.user.role === 'worker') where.workerId = request.user.id;

  const householdWhere = wardId ? { wardId } : undefined;
  const { count, rows } = await PickupLog.findAndCountAll({
    where,
    include: [
      { model: Household, as: 'household', where: householdWhere, required: Boolean(householdWhere), include: [{ model: Ward, as: 'ward' }] },
      { model: User, as: 'worker' },
    ],
    order: [['loggedAt', 'DESC']],
    limit: Number(limit),
    offset: (Number(page) - 1) * Number(limit),
    distinct: true,
  });
  response.json({ logs: rows, pagination: { page: Number(page), limit: Number(limit), total: count } });
}