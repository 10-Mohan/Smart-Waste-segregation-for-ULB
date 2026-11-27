import { Op } from 'sequelize';
import { Household, PickupLog, Ward, sequelize } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import { scopedWardId } from '../utils/access.js';
import { withHouseholdQrAllocation } from '../services/householdService.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middleware/auth.js';
import { issueCode, checkCode, normalizeIdentifier } from '../services/otpService.js';
import { sendEmailCode } from '../services/mailer.js';

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const GENERIC_MESSAGE = 'If this account exists, a code has been sent.';

const householdIncludesWard = [{ model: Ward, as: 'ward' }];


export async function verifyHouseholdEmail(request, response) {
  const { email, code } = request.body;
  if (!email) throw new HttpError(400, 'Email is required.');
  if (!code) throw new HttpError(400, 'Verification code is required.');
  if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  // Verify OTP code
  await checkCode({ channel: 'email', identifier: email, purpose: 'household-register', code });
  // Activate household
  const household = await Household.findOne({ where: { email } });
  if (!household) throw new HttpError(404, 'Household not found.');
  await household.update({ active: true });
  // Issue JWT session
  const token = jwt.sign({ hid: household.id, typ: 'citizen' }, getJwtSecret(), { expiresIn: '7d' });
  response.json({ token, household: { qrCode: household.qrCode, ownerFirstName: household.ownerName.trim().split(/\s+/)[0], email: household.email } });
}

export async function createHousehold(request, response) {
  const { ownerName, phone, address, type, email } = request.body;
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  if (normalizedEmail) {
    if (!emailPattern.test(normalizedEmail)) throw new HttpError(400, 'Enter a valid email address.');
    const existing = await Household.findOne({
      where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), normalizedEmail),
    });
    if (existing) throw new HttpError(409, 'Email already in use.');
  }
  const wardId = scopedWardId(request.user, request.body.wardId);
  const household = await withHouseholdQrAllocation(wardId, ({ qrCode, transaction }) =>
    Household.create({ ownerName, phone, address, type, email: normalizedEmail, active: true, wardId, qrCode }, { transaction })
  );
  if (normalizedEmail) {
    const code = await issueCode({ channel: 'email', identifier: normalizedEmail, purpose: 'household-register' });
    await sendEmailCode(normalizedEmail, code);
  }
  const result = await Household.findByPk(household.id, { include: householdIncludesWard });
  response.status(201).json({ household: result });
}

export async function listHouseholds(request, response) {
  const { wardId: requestedWardId, type, search, page = 1, limit = 20 } = request.query;
  const wardId = scopedWardId(request.user, requestedWardId);
  const where = {};
  if (wardId) where.wardId = wardId;
  if (type) where.type = type;
  if (search) {
    const likeOp = sequelize.getDialect() === 'postgres' ? Op.iLike : Op.like;
    where[Op.or] = ['ownerName', 'address', 'phone', 'qrCode'].map((field) => ({
      [field]: { [likeOp]: `%${search}%` },
    }));
  }

  const pageNumber = Number(page);
  const pageSize = Number(limit);
  const { count, rows } = await Household.findAndCountAll({
    where,
    include: householdIncludesWard,
    order: [['createdAt', 'DESC']],
    limit: pageSize,
    offset: (pageNumber - 1) * pageSize,
    distinct: true,
  });
  response.json({ households: rows, pagination: { page: pageNumber, limit: pageSize, total: count } });
}

export async function getHousehold(request, response) {
  const household = await Household.findByPk(request.params.id, { include: householdIncludesWard });
  if (!household) throw new HttpError(404, 'Household not found.');
  scopedWardId(request.user, household.wardId);
  response.json({ household });
}

export async function getHouseholdByQr(request, response) {
  const household = await Household.findOne({
    where: { qrCode: request.params.qrCode },
    include: [
      ...householdIncludesWard,
      {
        model: PickupLog,
        as: 'pickupLogs',
        separate: true,
        limit: 5,
        order: [['loggedAt', 'DESC']],
        attributes: ['id', 'status', 'reason', 'note', 'loggedAt', 'workerId'],
      },
    ],
  });
  if (!household) throw new HttpError(404, 'Household not found.');
  scopedWardId(request.user, household.wardId);
  response.json({ household });
}

export async function getHouseholdQr(request, response) {
  const household = await Household.findByPk(request.params.id, { include: householdIncludesWard });
  if (!household) throw new HttpError(404, 'Household not found.');
  scopedWardId(request.user, household.wardId);
  response.json({
    qrCode: household.qrCode,
    payload: {
      qrCode: household.qrCode,
      ownerName: household.ownerName,
      address: household.address,
      wardName: household.ward.name,
    },
  });
}