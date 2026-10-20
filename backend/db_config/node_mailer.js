const nodemailer = require('nodemailer');

const createTransporter = () => {
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  if (emailUser && emailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return null;
};

const sendOTPEmail = async (toEmail, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"MyChat Secure" <${process.env.EMAIL_USER || 'noreply@mychat.com'}>`,
    to: toEmail,
    subject: 'Your MyChat Verification OTP Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #0D5C52; margin: 0;">MyChat Verification</h2>
          <p style="color: #666; font-size: 14px;">Secure Real-time Messaging</p>
        </div>
        <p style="color: #333; font-size: 15px;">Hello,</p>
        <p style="color: #444; font-size: 14px; line-height: 1.5;">
          Thank you for signing up for MyChat. Please use the One-Time Password (OTP) below to verify your email address. This OTP is valid for <strong>10 minutes</strong>.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0D5C52; background: #E8F5F1; padding: 12px 30px; border-radius: 8px; border: 1px dashed #0D5C52;">
            ${otp}
          </span>
        </div>
        <p style="color: #888; font-size: 12px; text-align: center;">
          If you did not request this OTP, please ignore this email. Never share your OTP with anyone.
        </p>
      </div>
    `,
  };

  if (!transporter) {
    console.log(`\n==================================================`);
    console.log(`🔑 [DEV MODE] SMTP credentials not provided in .env`);
    console.log(`📩 OTP for ${toEmail}: 👉 ${otp} 👈`);
    console.log(`==================================================\n`);
    return { success: true, devMode: true, otp };
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Failed to send OTP email: ${err.message}`);
    // Fallback in dev so testing is not blocked
    console.log(`🔑 [DEV FALLBACK] OTP for ${toEmail}: ${otp}`);
    return { success: true, fallback: true, otp, error: err.message };
  }
};

module.exports = {
  sendOTPEmail,
};
