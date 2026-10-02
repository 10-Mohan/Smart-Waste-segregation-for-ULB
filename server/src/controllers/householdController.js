import { Op } from 'sequelize';
import { Household, PickupLog, Ward } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import { scopedWardId } from '../utils/access.js';
import { withHouseholdQrAllocation } from '../services/householdService.js';

const householdIncludesWard = [{ model: Ward, as: 'ward' }];

export async function createHousehold(request, response) {
  const { ownerName, phone, address, type } = request.body;
  const wardId = scopedWardId(request.user, request.body.wardId);
  const household = await withHouseholdQrAllocation(wardId, ({ qrCode, transaction }) => Household.create({
    ownerName,
    phone,
    address,
    type,
    wardId,
    qrCode,
  }, { transaction }));
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
    where[Op.or] = ['ownerName', 'address', 'phone', 'qrCode'].map((field) => ({
      [field]: { [Op.like]: `%${search}%` },
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