import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  householdId: { type: DataTypes.INTEGER, allowNull: false },
  pickupLogId: { type: DataTypes.INTEGER, allowNull: false },
  channel: { type: DataTypes.ENUM('sms', 'in_app'), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('queued', 'sent', 'failed'),
    allowNull: false,
    defaultValue: 'queued',
  },
});

export default Notification;