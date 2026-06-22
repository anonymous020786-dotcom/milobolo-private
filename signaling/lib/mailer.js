const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
});

const subjects = {
  verify: "Verify your MiloBolo account",
  reset: "Reset your MiloBolo password",
  delete: "Confirm account deletion",
  change_email: "Confirm email change",
};

const messages = {
  verify: (otp) => `Your MiloBolo email verification OTP is: <b>${otp}</b><br>Valid for 10 minutes.`,
  reset: (otp) => `Your password reset OTP is: <b>${otp}</b><br>Valid for 10 minutes. If you did not request this, ignore this email.`,
  delete: (otp) => `Your account deletion confirmation OTP is: <b>${otp}</b><br>Valid for 10 minutes. This action is irreversible.`,
  change_email: (otp) => `Your email change confirmation OTP is: <b>${otp}</b><br>Valid for 10 minutes.`,
};

exports.sendOTP = async ({ email, otp, type }) => {
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || "MiloBolo"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subjects[type] || "MiloBolo OTP",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f0f;color:#fff;border-radius:12px;">
        <h2 style="color:#6C63FF;margin-bottom:8px;">MiloBolo</h2>
        <p style="font-size:15px;line-height:1.6;">${messages[type]?.(otp) || `Your OTP is: <b>${otp}</b>`}</p>
        <div style="background:#1a1a2e;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#6C63FF;">${otp}</span>
        </div>
        <p style="font-size:12px;color:#666;">Do not share this OTP with anyone. MiloBolo will never ask for your OTP.</p>
      </div>
    `,
  });
};
