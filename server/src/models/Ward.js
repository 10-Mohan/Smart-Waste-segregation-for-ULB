import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Ward = sequelize.define('Ward', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING, allowNull: false, unique: true },
  zone: { type: DataTypes.STRING, allowNull: true },
});

export default Ward;