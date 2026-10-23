import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

function preventMutation() {
  throw new Error('Ratings are permanent and cannot be changed or deleted.');
}

// One rating per pickup. Created by the citizen whose household was visited.
const PickupRating = sequelize.define('PickupRating', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  pickupLogId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  householdId: { type: DataTypes.INTEGER, allowNull: false },
  workerId: { type: DataTypes.INTEGER, allowNull: false },
  stars: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  comment: { type: DataTypes.STRING(500), allowNull: true },
}, {
  indexes: [
    { fields: ['workerId', 'createdAt'] },
  ],
  hooks: {
    beforeUpdate: preventMutation,
    beforeBulkUpdate: preventMutation,
    beforeDestroy: preventMutation,
    beforeBulkDestroy: preventMutation,
  },
});

export default PickupRating;