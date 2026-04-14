const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

module.exports = {
  async sendOTP(toEmail, pilotName, code) {
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0; padding:0; background:#F7F5F0; font-family:'Barlow',Arial,sans-serif; }
  .wrap { max-width:520px; margin:40px auto; background:#0A1628; border-radius:12px; overflow:hidden; }
  .header { padding:32px 40px 24px; border-bottom:1px solid rgba(200,169,110,0.15); }
  .logo-text { font-size:22px; font-weight:700; letter-spacing:4px; color:#fff; text-transform:uppercase; }
  .logo-text span { color:#C8A96E; }
  .logo-sub { font-size:9px; letter-spacing:5px; color:rgba(200,169,110,0.45); text-transform:uppercase; margin-top:4px; }
  .body { padding:32px 40px; }
  .greeting { font-size:16px; color:rgba(255,255,255,0.7); margin-bottom:20px; font-weight:300; }
  .greeting strong { color:#fff; font-weight:600; }
  .desc { font-size:13px; color:rgba(255,255,255,0.45); line-height:1.7; margin-bottom:28px; }
  .otp-box { background:rgba(200,169,110,0.1); border:1px solid rgba(200,169,110,0.3); border-radius:8px; padding:24px; text-align:center; margin-bottom:24px; }
  .otp-label { font-size:10px; letter-spacing:3px; text-transform:uppercase; color:rgba(200,169,110,0.6); margin-bottom:12px; }
  .otp-code { font-size:48px; font-weight:700; letter-spacing:12px; color:#C8A96E; font-family:'Courier New',monospace; }
  .expiry { font-size:12px; color:rgba(255,255,255,0.3); text-align:center; margin-bottom:24px; }
  .warning { font-size:11px; color:rgba(255,255,255,0.2); line-height:1.6; padding-top:20px; border-top:1px solid rgba(255,255,255,0.06); }
  .footer { padding:16px 40px; background:rgba(0,0,0,0.2); font-size:10px; color:rgba(255,255,255,0.2); text-align:center; letter-spacing:1px; }
  .tricolore { display:flex; height:3px; }
  .tc-b { background:#0055A4; flex:1; }
  .tc-w { background:#fff; flex:1; opacity:0.6; }
  .tc-r { background:#EF4135; flex:1; }
</style>
</head>
<body>
<div class="wrap">
  <div class="tricolore"><div class="tc-b"></div><div class="tc-w"></div><div class="tc-r"></div></div>
  <div class="header">
    <div class="logo-text">LIBERT<span>É</span> AIR</div>
    <div class="logo-sub">Virtual Airlines · LBA</div>
  </div>
  <div class="body">
    <div class="greeting">Bonjour <strong>${pilotName}</strong>,</div>
    <div class="desc">
      Vous avez demandé à vérifier votre compte Liberté Air sur notre serveur Discord.<br>
      Entrez le code ci-dessous dans la fenêtre Discord pour finaliser la vérification.
    </div>
    <div class="otp-box">
      <div class="otp-label">Votre code de vérification</div>
      <div class="otp-code">${code}</div>
    </div>
    <div class="expiry">⏱  Ce code expire dans <strong style="color:rgba(200,169,110,0.8)">${process.env.OTP_EXPIRY_MINUTES || 10} minutes</strong>.</div>
    <div class="warning">
      Si vous n'avez pas demandé cette vérification, ignorez cet email.<br>
      Ne partagez jamais ce code avec quiconque, y compris le staff de Liberté Air.
    </div>
  </div>
  <div class="footer">LIBERTÉ AIR VIRTUAL · newhorisons.com · © 2026</div>
</div>
</body>
</html>`;

    await transporter.sendMail({
      from:    process.env.SMTP_FROM,
      to:      toEmail,
      subject: `[Liberté Air] Code de vérification Discord : ${code}`,
      html,
    });
  },

  async verify() {
    await transporter.verify();
    console.log('[MAILER] SMTP connection verified');
  },
};
