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

// ── shared layout wrapper ──────────────────────────────────────
function layout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>MiloBolo</title>
</head>
<body style="margin:0;padding:0;background:#0a0a12;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#6C63FF,#FF6584);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:-0.5px;">MiloBolo</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Free · Anonymous · Encrypted</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#13131f;border-radius:0 0 16px 16px;padding:36px 40px;">
          ${content}
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:28px 0;" />
          <p style="margin:0;font-size:12px;color:#555;line-height:1.6;text-align:center;">
            This email was sent from MiloBolo.<br>
            If you did not request this, you can safely ignore this email.<br>
            <span style="color:#3a3a50;">MiloBolo never asks for your OTP by phone or chat.</span>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── OTP display block ─────────────────────────────────────────
function otpBlock(otp) {
  const digits = otp.split("").map((d) =>
    `<span style="display:inline-block;width:44px;height:56px;line-height:56px;background:#1e1e32;border:2px solid #6C63FF44;border-radius:10px;font-size:28px;font-weight:900;color:#6C63FF;text-align:center;margin:0 4px;">${d}</span>`
  ).join("");
  return `
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;">${digits}</div>
      <p style="margin:14px 0 0;font-size:13px;color:#666;">Valid for <b style="color:#999;">10 minutes</b></p>
    </div>`;
}

// ── subject + body map ────────────────────────────────────────
const templates = {
  verify: {
    subject: "Verify your MiloBolo account",
    icon: "✅",
    heading: "Verify your email",
    body: (otp) => `
      <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Welcome to MiloBolo! Use the code below to verify your email address and activate your account.
      </p>
      ${otpBlock(otp)}
      <p style="color:#666;font-size:13px;margin:0;">Once verified, you can save chat history, add friends, and customise your profile.</p>`,
  },
  reset: {
    subject: "Reset your MiloBolo password",
    icon: "🔐",
    heading: "Password reset request",
    body: (otp) => `
      <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 8px;">
        We received a request to reset your password. Enter the code below on the reset page.
      </p>
      ${otpBlock(otp)}
      <p style="color:#666;font-size:13px;margin:0;">
        If you didn't request a password reset, no action is needed — your account is safe.
      </p>`,
  },
  delete: {
    subject: "Confirm your MiloBolo account deletion",
    icon: "⚠️",
    heading: "Confirm account deletion",
    body: (otp) => `
      <div style="background:rgba(244,67,54,0.08);border:1px solid rgba(244,67,54,0.2);border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;color:#f44336;font-size:14px;font-weight:600;">⚠️ This action is permanent and cannot be undone.</p>
      </div>
      <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 8px;">
        To permanently delete your account and all associated data, enter this code to confirm.
      </p>
      ${otpBlock(otp)}
      <p style="color:#666;font-size:13px;margin:0;">If you did not request this, change your password immediately.</p>`,
  },
  change_email: {
    subject: "Confirm your MiloBolo email change",
    icon: "📧",
    heading: "Confirm email change",
    body: (otp) => `
      <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 8px;">
        You requested to change the email address on your MiloBolo account. Use the code below to confirm.
      </p>
      ${otpBlock(otp)}
      <p style="color:#666;font-size:13px;margin:0;">If you didn't request this change, please secure your account immediately.</p>`,
  },
};

exports.sendOTP = async ({ email, otp, type }) => {
  const tmpl = templates[type] || {
    subject: "MiloBolo OTP",
    icon: "🔢",
    heading: "Your one-time code",
    body: (otp) => `<p style="color:#ccc;">Your OTP is:</p>${otpBlock(otp)}`,
  };

  const html = layout(`
    <p style="margin:0 0 4px;font-size:24px;">${tmpl.icon}</p>
    <h2 style="margin:0 0 20px;color:#fff;font-size:20px;font-weight:700;">${tmpl.heading}</h2>
    ${tmpl.body(otp)}
  `);

  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || "MiloBolo"}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: tmpl.subject,
    html,
  });
};
