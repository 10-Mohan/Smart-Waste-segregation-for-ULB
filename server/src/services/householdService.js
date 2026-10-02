import { Op, Transaction } from 'sequelize';
import { Household, sequelize, Ward } from '../models/index.js';
import HttpError from '../utils/HttpError.js';

export function normalizeAddress(address) {
  return String(address).normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export async function generateNextWardQrCode(ward, transaction) {
  const prefix = `HH-${ward.code}-`;
  const existingCodes = await Household.findAll({
    where: { wardId: ward.id, qrCode: { [Op.like]: `${prefix}%` } },
    attributes: ['qrCode'],
    transaction,
  });
  const lastNumber = existingCodes.reduce((highest, household) => {
    const suffix = Number(household.qrCode.slice(prefix.length));
    return Number.isInteger(suffix) ? Math.max(highest, suffix) : highest;
  }, 0);
  if (lastNumber >= 999) throw new HttpError(409, 'No QR code numbers remain for this ward.');
  return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
}

export async function withHouseholdQrAllocation(wardId, operation) {
  const transactionOptions = sequelize.getDialect() === 'sqlite'
    ? { type: Transaction.TYPES.IMMEDIATE }
    : {};

  return sequelize.transaction(transactionOptions, async (transaction) => {
    const wardOptions = { transaction };
    if (sequelize.getDialect() === 'postgres') wardOptions.lock = transaction.LOCK.UPDATE;
    const ward = await Ward.findByPk(wardId, wardOptions);
    if (!ward) throw new HttpError(404, 'Ward not found.');
    const qrCode = await generateNextWardQrCode(ward, transaction);
    return operation({ ward, qrCode, transaction });
  });
}