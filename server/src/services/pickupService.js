import { Op, UniqueConstraintError } from 'sequelize';
import {
  Household,
  Notification,
  PickupLog,
  PointsLedger,
  sequelize,
  Ward,
  User,
} from '../models/index.js';
import { calculatePoints } from './pointsService.js';
import { sendPickupSms } from './notificationService.js';
import HttpError from '../utils/HttpError.js';

function messageForPickup(status, reason, points) {
  if (status === 'segregated') {
    return `Thank you for segregating your waste. You earned ${points} eco-points.`;
  }
  if (status === 'rejected') {
    return `Today's pickup was rejected because ${reason}. Keep wet, dry, and sanitary waste separate before the next collection.`;
  }
  return 'Your waste was collected as mixed. Please keep wet and dry waste in separate bins for the next pickup.';
}

async function findExistingLog(clientUuid) {
  return PickupLog.findOne({
    where: { clientUuid },
    include: [
      { model: Household, as: 'household', include: [{ model: Ward, as: 'ward' }] },
      { model: User, as: 'worker' },
    ],
  });
}

export async function createPickup(input, worker) {
  const duplicate = await findExistingLog(input.clientUuid);
  if (duplicate) return { duplicate: true, log: duplicate };

  const loggedAt = input.loggedAt ? new Date(input.loggedAt) : new Date();
  let created;
  try {
    created = await sequelize.transaction(async (transaction) => {
      const household = await Household.findOne({
        where: { qrCode: input.qrCode },
        transaction,
      });
      if (!household) throw new HttpError(404, 'Household QR code was not found.');
      if (!household.active) throw new HttpError(409, 'This household is inactive.');
      if (household.wardId !== worker.wardId) {
        throw new HttpError(403, 'You can only log pickups in your own ward.');
      }

      const pickupLog = await PickupLog.create({
        clientUuid: input.clientUuid,
        householdId: household.id,
        workerId: worker.id,
        status: input.status,
        reason: input.reason || null,
        note: input.note || null,
        loggedAt,
      }, { transaction });

      const previousLogs = await PickupLog.findAll({
        where: {
          householdId: household.id,
          [Op.or]: [
            { loggedAt: { [Op.lt]: loggedAt } },
            { loggedAt, id: { [Op.lt]: pickupLog.id } },
          ],
        },
        attributes: ['status', 'loggedAt'],
        order: [['loggedAt', 'ASC'], ['id', 'ASC']],
        transaction,
      });
      const award = calculatePoints(previousLogs, input.status);
      const ecoPointsTotal = household.ecoPoints + award.points;
      await household.update({ ecoPoints: ecoPointsTotal }, { transaction });
      await PointsLedger.create({
        householdId: household.id,
        pickupLogId: pickupLog.id,
        points: award.points,
        reason: award.reason,
        balanceAfter: ecoPointsTotal,
      }, { transaction });

      const message = messageForPickup(input.status, input.reason, award.points);
      const inAppNotification = await Notification.create({
        householdId: household.id,
        pickupLogId: pickupLog.id,
        channel: 'in_app',
        message,
      }, { transaction });
      return { pickupLog, household, award, ecoPointsTotal, message, inAppNotification };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const racedDuplicate = await findExistingLog(input.clientUuid);
      if (racedDuplicate) return { duplicate: true, log: racedDuplicate };
    }
    throw error;
  }

  const smsNotification = await sendPickupSms({
    household: created.household,
    pickupLog: created.pickupLog,
    message: created.message,
  });
  const log = await PickupLog.findByPk(created.pickupLog.id, {
    include: [
      { model: Household, as: 'household', include: [{ model: Ward, as: 'ward' }] },
      { model: User, as: 'worker' },
    ],
  });

  return {
    duplicate: false,
    log,
    pointsAwarded: created.award.points,
    ecoPointsTotal: created.ecoPointsTotal,
    notification: { inApp: created.inAppNotification, sms: smsNotification },
  };
}