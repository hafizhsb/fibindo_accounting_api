
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');
const { generateInternalToken, generatePassword, verifyPassword } = require('../lib/auth');
const { send } = require('../lib/mail');

const country = async (request) => {
  const { db } = dbLib;

  let selectQuery = 'select * from countries order by country_name asc';
  let countQuery = 'select count(*) from countries';
  
  return db.multi(`${selectQuery};${countQuery}`);
}

const province = async (request) => {
  const { db } = dbLib;

  let selectQuery = 'select * from provinces where country_id = 228 order by province_name asc';
  let countQuery = 'select count(*) from provinces where country_id = 228';
  
  return db.multi(`${selectQuery};${countQuery}`);
}

const city = async (request) => {
  const { db } = dbLib;
  const { id } = request.params;

  let selectQuery = 'select * from cities where province_id = $1 order by city_name asc';
  let countQuery = 'select count(*) from cities where province_id = $1';
  
  return db.multi(`${selectQuery};${countQuery}`, [id]);
}

const suburb = async (request) => {
  const { db } = dbLib;
  const { id } = request.params;

  let selectQuery = 'select * from suburbs where city_id = $1 order by suburb_name asc';
  let countQuery = 'select count(*) from suburbs where city_id = $1';
  
  console.log('aaa', pgp.as.format(`${selectQuery};${countQuery}`));
  return db.multi(`${selectQuery};${countQuery}`, [id]);
}

const area = async (request) => {
  const { db } = dbLib;
  const { id } = request.params;

  let selectQuery = 'select * from areas where suburb_id = $1 order by area_name asc';
  let countQuery = 'select count(*) from areas where suburb_id = $1';
  
  return db.multi(`${selectQuery};${countQuery}`, [id]);
}

module.exports = {
  country,
  province,
  city,
  suburb,
  area
}