import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { User } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import { getJwtSecret } from '../middleware/auth.js';
import { issueCode, checkCode, normalizeIdentifier } from '../services/otpService.js';
import { sendEmailCode } from '../services/mailer.js';
import { sendSmsCode } from '../services/sms.js';

const phoneEnabled = () => process.env.PHONE_OTP_ENABLED === 'true' || process.env.NODE_ENV !== 'production';

export function readInput(body) {
  const channel = body.channel;
  if (!['email', 'phone'].includes(channel)) throw new HttpError(400, 'Choose email or phone.');
  if (channel === 'phone' && !phoneEnabled()) {
    throw new HttpError(503, 'Phone sign-in is coming soon. Please use email.');
  }
  const identifier = normalizeIdentifier(channel, body.identifier);
  if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier)) {
    throw new HttpError(400, 'Enter a valid email address.');
  }
  if (channel === 'phone' && identifier.length !== 10) {
    throw new HttpError(400, 'Enter a valid 10-digit phone number.');
  }
  return { channel, identifier };
}

async function findStaff(channel, identifier) {
  if (channel === 'email') {
    return User.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), identifier) });
  }
  return User.findOne({ where: { phone: { [Op.like]: `%${identifier}` } } });
}

export async function requestStaffCode(request, response) {
  const { channel, identifier } = readInput(request.body);
  const user = await findStaff(channel, identifier);
  const code = await issueCode({ channel, identifier, purpose: 'staff-login' });

  if (user) {
    try {
      if (channel === 'email') await sendEmailCode(user.email, code);
      else await sendSmsCode(identifier, code);
    } catch (error) {
      console.error('OTP delivery failed:', error.message);
      throw new HttpError(502, 'We could not send the code. Please try again shortly.');
    }
  }
  response.json({ message: 'If this account exists, a code has been sent.' });
}

export async function verifyStaffCode(request, response) {
  const { channel, identifier } = readInput(request.body);
  await checkCode({ channel, identifier, purpose: 'staff-login', code: request.body.code });

  const user = await findStaff(channel, identifier);
  if (!user) throw new HttpError(401, 'The code is incorrect or has expired.');

  const token = jwt.sign({ sub: user.id }, getJwtSecret(), { expiresIn: '8h' });
  response.json({ token, user });
}