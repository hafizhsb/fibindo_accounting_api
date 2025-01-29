const nodemailer = require('nodemailer');
const config = require('../config');

module.exports.send = async (to, subject, content) => {
  let transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: true, // true for 465, false for other ports
    auth: {
      user: config.SMTP_USER, 
      pass: config.SMTP_PASSWORD,
    },
  });

  return transporter.sendMail({
    from: config.SMTP_USER, // sender address
    to: to, // list of receivers
    subject: subject, // Subject line
    html: content, // html body
  });
}