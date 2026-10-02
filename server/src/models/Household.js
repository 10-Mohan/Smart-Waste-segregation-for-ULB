import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Household = sequelize.define('Household', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  qrCode: { type: DataTypes.STRING, allowNull: false, unique: true },
  ownerName: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('residential', 'commercial'), allowNull: false },
  wardId: { type: DataTypes.INTEGER, allowNull: false },
  ecoPoints: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

export default Household;