import Household from './Household.js';
import Notification from './Notification.js';
import PickupLog from './PickupLog.js';
import PointsLedger from './PointsLedger.js';
import User from './User.js';
import Ward from './Ward.js';
import { sequelize } from '../config/database.js';

Ward.hasMany(User, { as: 'users', foreignKey: 'wardId' });
User.belongsTo(Ward, { as: 'ward', foreignKey: 'wardId' });
Ward.hasMany(Household, { as: 'households', foreignKey: 'wardId' });
Household.belongsTo(Ward, { as: 'ward', foreignKey: 'wardId' });

Household.hasMany(PickupLog, { as: 'pickupLogs', foreignKey: 'householdId' });
PickupLog.belongsTo(Household, { as: 'household', foreignKey: 'householdId' });
User.hasMany(PickupLog, { as: 'workerPickupLogs', foreignKey: 'workerId' });
PickupLog.belongsTo(User, { as: 'worker', foreignKey: 'workerId' });

Household.hasMany(Notification, { as: 'notifications', foreignKey: 'householdId' });
Notification.belongsTo(Household, { as: 'household', foreignKey: 'householdId' });
PickupLog.hasMany(Notification, { as: 'notifications', foreignKey: 'pickupLogId' });
Notification.belongsTo(PickupLog, { as: 'pickupLog', foreignKey: 'pickupLogId' });

Household.hasMany(PointsLedger, { as: 'pointsLedger', foreignKey: 'householdId' });
PointsLedger.belongsTo(Household, { as: 'household', foreignKey: 'householdId' });
PickupLog.hasMany(PointsLedger, { as: 'pointsEntries', foreignKey: 'pickupLogId' });
PointsLedger.belongsTo(PickupLog, { as: 'pickupLog', foreignKey: 'pickupLogId' });

export {
  Household,
  Notification,
  PickupLog,
  PointsLedger,
  User,
  Ward,
  sequelize,
};