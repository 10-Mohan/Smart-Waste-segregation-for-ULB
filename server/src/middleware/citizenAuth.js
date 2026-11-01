import jwt from 'jsonwebtoken';
import { Household } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import asyncHandler from './asyncHandler.js';
import { getJwtSecret } from './auth.js';

/**
 * If the request carries a citizen session token, resolve the household and fill in its
 * credentials so existing citizen endpoints work unchanged. Staff tokens and requests with
 * no token pass straight through to the legacy QR code + last-4 check.
 */
export const identifyCitizen = asyncHandler(async (request, _response, next) => {
  const [scheme, token] = request.get('authorization')?.split(' ') || [];
  if (scheme !== 'Bearer' || !token) return next();

  const decoded = jwt.decode(token);
  if (decoded?.typ !== 'citizen') return next();

  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again.');
  }
  const household = await Household.findByPk(payload.hid);
  if (!household || !household.active) throw new HttpError(401, 'Your session has expired. Please sign in again.');

  request.citizenHousehold = household;
  const credentials = { qrCode: household.qrCode, phoneLast4: household.phone.slice(-4) };
  Object.defineProperty(request, 'query', {
    value: { ...request.query, ...credentials },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  if (request.body && typeof request.body === 'object') Object.assign(request.body, credentials);
  return next();
});