
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');

const list = async (page, pageSize) => {
  const { db } = dbLib;
  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $1 offset $2`;
  }

  const data =  await db.query(`
    select *
    from contact
    order by contact_name asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from contact
  `);

  return {
    data,
    count: count.total
  }
}

const getAccountDetail = async (id) => {
  const { db } = dbLib;
  return db.oneOrNone(`
  select *
  from contact
  where account_id = $1
  `, [id]);
}

const updateContact = async (id, data) => {
  const { db, pgpHelpers } = dbLib;
  console.log('dataaaa', data);
  
  const updateSql = pgpHelpers.update(data, null, 'contact') + `where contact_id = $1`;
  // console.log(updateSql)
  return db.none(updateSql, [id]);
}

const createContact = async (data) => {
  const { db, pgpHelpers } = dbLib;

  const sql = pgpHelpers.insert(data, null, 'contact');
  console.log('sqlll', sql);
  return db.oneOrNone(sql);
}

module.exports = {
  list,
  getAccountDetail,
  updateContact,
  createContact
}