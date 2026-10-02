import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.ENUM('worker', 'supervisor', 'ulb_admin'),
    allowNull: false,
  },
  phone: { type: DataTypes.STRING, allowNull: true },
  wardId: { type: DataTypes.INTEGER, allowNull: true },
}, {
  defaultScope: { attributes: { exclude: ['passwordHash'] } },
});

User.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  delete values.passwordHash;
  return values;
};

export default User;