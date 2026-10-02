import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const PointsLedger = sequelize.define('PointsLedger', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  householdId: { type: DataTypes.INTEGER, allowNull: false },
  pickupLogId: { type: DataTypes.INTEGER, allowNull: false },
  points: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: false },
  balanceAfter: { type: DataTypes.INTEGER, allowNull: false },
});

export default PointsLedger;