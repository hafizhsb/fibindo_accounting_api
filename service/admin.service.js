
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');
const { generateInternalToken, generatePassword, verifyPassword } = require('../lib/auth');
const { send } = require('../lib/mail');

const login = async (body, token) => {
  try {
    const { db, pgpHelpers } = dbLib;
    const { email, password } = body;
    
    const member = await db.oneOrNone('select * from admin where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const isValid = await verifyPassword(password, member.password);
    if (!isValid) {
      throw new Error('Email atau password salah');
    }

    if (member.deleted_at) {
      throw new Error('Akun anda sudah dihapus');
    }

    await db.query('update member set is_logged_in = true, last_login = now() where id = $1', member.id);

    const data = {
      email: member.email,
      fullname: member.fullname,
      role: 'admin',
      token
    }
    return data;
  } catch (err) {
    console.log(err);
    throw new Error(err.message);
  }
}

const createUser = async (body) => {
  const { db, pgpHelpers } = dbLib;
  const { email, password, fullname } = body;

  try {
    const exists = await db.oneOrNone('select * from member where email = $1', [email]);
    console.log('exisst', exists);
    if (exists) {
      if (exists.is_verified) {
        throw new Error('Email sudah digunakan');
      } else {
        // recreate activation token and resend to user
        const token = generateInternalToken(email);
        await db.query('update member set activation_token = $1 where email = $2', [token, email]);
        // await sendActivationEmail(email, token);
        throw new Error('Email anda sudah terdaftar, silahkan cek email untuk mengaktifkannya');
      }
    }
    
    const token = generateInternalToken(email);
  
    const data = {
      email,
      password: await generatePassword(password),
      fullname,
      activation_token: token,
      created_at: 'now()',
      created_by: email
    }
  
    const sql = pgpHelpers.insert(data, null, 'member');
    await db.none(sql);
  
    // send activation token;
    try {
      console.log('send activation token');
      const content = `<p>Halo ${fullname}</p>
      <p>Anda Telah Melakukan Pendaftaran Akun di <a href="https://fibindo.co.id">Fibindo.co.id</a>. Berikut data Akun Anda untuk dapat masuk:</p>
      <p>Email : ${email}</p>
      <p><br></p>
      <p>Link Aktivasi :  ${config.SITE_URL}/activation/${token}</p>`
      await send(email, 'Email Aktivasi', content);
      console.log(`send email to ${email} success`);
    } catch (err) {
      console.log('send email failed', err);
    }
    return true;
  } catch (err) {
    console.log('error nih', err);
    throw new Error(err.message);
  }
};

const activate = async (token) => {
  const { db } = dbLib;

  try {
    const exist = await db.oneOrNone('select * from member where activation_token = $1', [token]);

    if (!exist) {
      throw new Error('Aktivasi token tidak valid');
    }
    
    return db.query('update member set is_active = true, is_verified = true, activation_token = null where email = $1', [exist.email]);
  } catch (err) {
    console.log('error nih', err);
    throw new Error(err.message);
  }
};

const forgotPassword = async (body) => {
  const { db } = dbLib;
  const { email } = body;
  const member = await db.oneOrNone('select * from member where email = $1', [email]);
  if (!member) {
    throw new Error('Email tidak terdaftar');
  }
  const token = generateInternalToken(email);
  await db.query('update member set reset_password_token = $1, last_forgot_password = now() where email = $2', [token, email]);
  try {
    await send(email, 'Reset Password', `Link reset password: ${config.SITE_URL}/reset-password/${token}`);
  } catch (err) {
    console.log('error send email', email);
  }
};

const resetPassword = async (body) => {
  const { db } =  dbLib;
  const { token, password } = body;
  const member = await db.oneOrNone('select * from member where reset_password_token = $1', [token]);
  if (!member) {
    throw new Error('Token tidak valid');
  }

  // token expired for 60 minutes
  // const now = moment(new Date()); //todays date
  // const start = moment(member.last_forgot_password);
  // var duration = moment.duration(now.diff(start));
  // var minutes = duration.asMinutes();
  // if (minutes > 60) {
  //   throw new Error('Token telah kadaluarsa');
  // }
  const newPassword = await generatePassword(password);
  return db.query('update member set reset_password_token = null, password = $2 where email = $1', [member.email, newPassword]);
};

module.exports = {
  createUser,
  login,
  activate,
  forgotPassword,
  resetPassword
}