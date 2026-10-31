import crypto from 'node:crypto';
import { Op } from 'sequelize';
import OtpCode from '../models/OtpCode.js';
import HttpError from '../utils/HttpError.js';
import { getJwtSecret } from '../middleware/auth.js';

const TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export function normalizeIdentifier(channel, value) {
  if (channel === 'email') return String(value).trim().toLowerCase();
  return String(value).replace(/\D/g, '').slice(-10);
}

function hashCode(channel, identifier, purpose, code) {
  return crypto.createHmac('sha256', getJwtSecret())
    .update(`${channel}|${identifier}|${purpose}|${code}`)
    .digest('hex');
}

/** Always creates a code row (even for unknown accounts) so responses look identical. */
export async function issueCode({ channel, identifier, purpose }) {
  const recent = await OtpCode.findOne({
    where: { channel, identifier, purpose, createdAt: { [Op.gt]: new Date(Date.now() - COOLDOWN_MS) } },
  });
  if (recent) throw new HttpError(429, 'Please wait a minute before requesting another code.');

  await OtpCode.destroy({ where: { expiresAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  await OtpCode.update(
    { consumedAt: new Date() },
    { where: { channel, identifier, purpose, consumedAt: null } },
  );

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await OtpCode.create({
    channel,
    identifier,
    purpose,
    codeHash: hashCode(channel, identifier, purpose, code),
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return code;
}

export async function checkCode({ channel, identifier, purpose, code }) {
  const invalid = () => new HttpError(401, 'The code is incorrect or has expired.');
  const row = await OtpCode.findOne({
    where: { channel, identifier, purpose, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['createdAt', 'DESC']],
  });
  if (!row) throw invalid();

  await OtpCode.increment('attempts', { where: { id: row.id } });
  await row.reload();
  if (row.attempts > MAX_ATTEMPTS) throw invalid();

  const expected = Buffer.from(row.codeHash, 'hex');
  const actual = Buffer.from(hashCode(channel, identifier, purpose, String(code)), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) throw invalid();

  row.consumedAt = new Date();
  await row.save();
}