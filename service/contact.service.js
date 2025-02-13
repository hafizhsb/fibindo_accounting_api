
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');

const list = async (req) => {
  const { db } = dbLib;
  const { page, page_size: pageSize } = req.query;
  const { schemaName  } = req.user;

  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $1 offset $2`;
  }

  const data =  await db.query(`
    select *
    from ${schemaName}.contact
    order by contact_name asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from ${schemaName}.contact
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

const updateContact = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { body: data } = req;
  const { schemaName  } = req.user;

  console.log('reqqq', id, body);
  console.log('dataaaa', data);
  
  const updateSql = pgpHelpers.update(data, null, { table: 'contact', schema: schemaName }) + `where contact_id = $1`;
  // console.log(updateSql)
  return db.none(updateSql, [id]);
}

const createContact = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { body: data } = req;
  const { schemaName  } = req.user;

  const sql = pgpHelpers.insert(data, null, { table: 'contact', schema: schemaName });
  console.log('sqlll', sql);
  return db.oneOrNone(sql);
}

module.exports = {
  list,
  getAccountDetail,
  updateContact,
  createContact
}