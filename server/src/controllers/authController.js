import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import { getJwtSecret } from '../middleware/auth.js';

export async function login(request, response) {
  const user = await User.unscoped().findOne({ where: { email: request.body.email } });
  if (!user || !(await bcrypt.compare(request.body.password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  const token = jwt.sign({ sub: user.id }, getJwtSecret(), { expiresIn: '8h' });
  response.json({ token, user });
}

export function me(request, response) {
  response.json({ user: request.user });
}