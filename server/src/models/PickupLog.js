import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

function preventMutation() {
  throw new Error('Pickup logs are immutable and cannot be changed or deleted.');
}

const PickupLog = sequelize.define('PickupLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  clientUuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  householdId: { type: DataTypes.INTEGER, allowNull: false },
  workerId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('segregated', 'mixed', 'rejected'), allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true },
  loggedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  syncedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  validate: {
    rejectedRequiresReason() {
      if (this.status === 'rejected' && !this.reason?.trim()) {
        throw new Error('A reason is required when a pickup is rejected.');
      }
    },
  },
  indexes: [
    { fields: ['householdId', 'loggedAt'] },
    { fields: ['status', 'loggedAt'] },
  ],
  hooks: {
    beforeUpdate: preventMutation,
    beforeBulkUpdate: preventMutation,
    beforeDestroy: preventMutation,
    beforeBulkDestroy: preventMutation,
  },
});

export default PickupLog;