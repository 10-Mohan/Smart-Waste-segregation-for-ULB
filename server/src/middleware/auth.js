import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import asyncHandler from './asyncHandler.js';

const developmentSecret = 'development-only-secret-replace-before-deployment';

export function getJwtSecret() {
  return process.env.JWT_SECRET || developmentSecret;
}

export const authenticate = asyncHandler(async (request, _response, next) => {
  const authorization = request.get('authorization');
  const [scheme, token] = authorization?.split(' ') || [];
  if (scheme !== 'Bearer' || !token) {
    throw new HttpError(401, 'A Bearer token is required.');
  }

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    throw new HttpError(401, 'The authentication token is invalid or expired.');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) throw new HttpError(401, 'The token user no longer exists.');
  request.user = user;
  next();
});

export function authorize(...roles) {
  return (request, _response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      next(new HttpError(403, 'You do not have permission to access this resource.'));
      return;
    }
    next();
  };
}