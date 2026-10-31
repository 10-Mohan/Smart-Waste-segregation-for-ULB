import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS).replace(/\s/g, '') },
    });
  }
  return transporter;
}

export async function sendEmailCode(to, code) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured.');
    console.log(`[DEV ONLY] Email code for ${to}: ${code}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `Waste Segregation Monitoring <${process.env.SMTP_USER}>`,
    to,
    subject: `Your sign-in code: ${code}`,
    text: `Your Waste Segregation Monitoring sign-in code is ${code}. It expires in 5 minutes. If you did not request it, ignore this email.`,
    html: `<p>Your Waste Segregation Monitoring sign-in code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>It expires in 5 minutes. If you did not request it, ignore this email.</p>`,
  });
}