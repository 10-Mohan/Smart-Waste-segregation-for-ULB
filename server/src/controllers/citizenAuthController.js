import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Household } from '../models/index.js';
import HttpError from '../utils/HttpError.js';
import { getJwtSecret } from '../middleware/auth.js';
import { issueCode, checkCode, normalizeIdentifier } from '../services/otpService.js';
import { sendEmailCode } from '../services/mailer.js';
import { sendSmsCode } from '../services/sms.js';
import { readInput } from './otpController.js';

const GENERIC_MESSAGE = 'If this account exists, a code has been sent.';
const invalidCode = () => new HttpError(401, 'The code is incorrect or has expired.');
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function emailMatch(email) {
  return sequelize.where(sequelize.fn('lower', sequelize.col('email')), email);
}

async function findHouseholds(channel, identifier) {
  if (channel === 'email') {
    return Household.findAll({ where: { [Op.and]: [emailMatch(identifier), { active: true }] } });
  }
  return Household.findAll({ where: { phone: { [Op.like]: `%${identifier}` }, active: true } });
}

async function findByLegacyDetails(qrCode, phoneLast4) {
  const household = await Household.findOne({ where: { qrCode: String(qrCode || '').trim().toUpperCase() } });
  if (!household || household.phone.slice(-4) !== String(phoneLast4 || '')) {
    throw new HttpError(404, 'Household was not found for the supplied details.');
  }
  return household;
}

function sendSession(response, household) {
  const token = jwt.sign({ hid: household.id, typ: 'citizen' }, getJwtSecret(), { expiresIn: '7d' });
  response.json({
    token,
    household: { qrCode: household.qrCode, ownerFirstName: household.ownerName.trim().split(/\s+/)[0], email: household.email || null },
  });
}

async function deliver(channel, target, code) {
  try {
    if (channel === 'email') await sendEmailCode(target, code);
    else await sendSmsCode(target, code);
  } catch (error) {
    console.error('Citizen OTP delivery failed:', error.message);
    throw new HttpError(502, 'We could not send the code. Please try again shortly.');
  }
}

export async function requestCitizenCode(request, response) {
  const { channel, identifier } = readInput(request.body);
  const matches = await findHouseholds(channel, identifier);
  const code = await issueCode({ channel, identifier, purpose: 'citizen-login' });
  if (matches.length) await deliver(channel, identifier, code);
  response.json({ message: GENERIC_MESSAGE });
}

export async function verifyCitizenCode(request, response) {
  const { channel, identifier } = readInput(request.body);
  await checkCode({ channel, identifier, purpose: 'citizen-login', code: request.body.code });
  const matches = await findHouseholds(channel, identifier);
  if (!matches.length) throw invalidCode();
  if (matches.length > 1) {
    throw new HttpError(409, 'This phone number is used by more than one household. Please sign in with your email.');
  }
  sendSession(response, matches[0]);
}

function readLinkEmail(body) {
  const email = normalizeIdentifier('email', body.email);
  if (!emailPattern.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  return email;
}

export async function requestLinkCode(request, response) {
  const email = readLinkEmail(request.body);
  const household = await findByLegacyDetails(request.body.qrCode, request.body.phoneLast4);
  const taken = await Household.findOne({
    where: { [Op.and]: [emailMatch(email), { id: { [Op.ne]: household.id } }] },
  });
  if (taken) throw new HttpError(409, 'That email is already linked to another household.');

  const code = await issueCode({ channel: 'email', identifier: email, purpose: 'citizen-link' });
  await deliver('email', email, code);
  response.json({ message: 'A 6-digit code has been sent to that email.' });
}

export async function verifyLinkCode(request, response) {
  const email = readLinkEmail(request.body);
  const household = await findByLegacyDetails(request.body.qrCode, request.body.phoneLast4);
  await checkCode({ channel: 'email', identifier: email, purpose: 'citizen-link', code: request.body.code });
  try {
    await household.update({ email });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, 'That email is already linked to another household.');
    }
    throw error;
  }
  sendSession(response, household);
}