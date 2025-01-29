const JWT = require("@fastify/jwt");
const bcrypt = require('bcrypt');
const sha256 = require('crypto-js/sha256');

const config = require('../config');
const { db } = require('../lib/db');

exports.initAuth = function(server) {
  server.auth.strategy('jwt', 'jwt',
  {
    key: config.JWT_KEY,
    validate,
    verifyOptions: { algorithms: ['HS256'] }
  })
}


// bring your own validation function
const validate = async function (decoded, request, h) {
  try {
    if (!decoded.email) {
      return { isValid: false };
    }
    
    const admin = await db.oneOrNone('SELECT email from admin where email = $1 and deleted_at is null', [decoded.email]);
  
    const member = await db.oneOrNone('select email from member where email = $1 and deleted_at is null', [decoded.email])
  
    if (!admin && !member) {
      return { isValid: false };
    }
  
    return { isValid: true };
  } catch (err) {
    console.log(err);
    throw err;
  }
  
};

exports.getToken = function(data) {
  return JWT.sign(data, config.JWT_KEY, { expiresIn: '24h'});
};

exports.generatePassword = function(password) {
  return bcrypt.hash(password, 10);
};

exports.verifyPassword = function(password, hash) {
  return bcrypt.compare(password, hash);
}

exports.generateInternalToken = function(email) {
  return sha256(`${new Date()}${email}`).toString();
}