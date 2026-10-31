export async function sendSmsCode(phone, code) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMS provider is not configured.');
  }
  console.log(`[DEV ONLY] SMS code for ${phone}: ${code}`);
}