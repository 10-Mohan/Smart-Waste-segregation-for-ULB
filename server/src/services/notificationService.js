import { Notification } from '../models/index.js';

const consoleProvider = {
  async sendSms({ to, message }) {
    console.log(`[SMS console provider] to=${to} message=${message}`);
    return { status: 'sent' };
  },
};

const fast2smsProvider = {
  async sendSms({ to, message }) {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) throw new Error('FAST2SMS_API_KEY is not configured.');

    // Replace this stub with the Fast2SMS HTTP request when provider credentials are provisioned.
    void to;
    void message;
    throw new Error('Fast2SMS HTTP delivery has not been configured.');
  },
};

const providers = { console: consoleProvider, fast2sms: fast2smsProvider };

export async function sendPickupSms({ household, pickupLog, message }) {
  let notification;
  try {
    notification = await Notification.create({
      householdId: household.id,
      pickupLogId: pickupLog.id,
      channel: 'sms',
      message,
      status: 'queued',
    });
    const providerName = process.env.SMS_PROVIDER || 'console';
    const provider = providers[providerName];
    if (!provider) throw new Error(`Unsupported SMS_PROVIDER: ${providerName}`);
    await provider.sendSms({ to: household.phone, message });
    await notification.update({ status: 'sent' });
  } catch (error) {
    if (notification) {
      try {
        await notification.update({ status: 'failed' });
      } catch (updateError) {
        console.error('Could not mark SMS notification as failed:', updateError.message);
      }
    }
    console.error('SMS delivery failed:', error.message);
    return notification || { channel: 'sms', status: 'failed', message };
  }

  return notification;
}