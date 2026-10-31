import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const OtpCode = sequelize.define('OtpCode', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  channel: { type: DataTypes.STRING, allowNull: false },
  identifier: { type: DataTypes.STRING, allowNull: false },
  purpose: { type: DataTypes.STRING, allowNull: false },
  codeHash: { type: DataTypes.STRING, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  consumedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  indexes: [{ fields: ['channel', 'identifier', 'purpose'] }],
});

export default OtpCode;