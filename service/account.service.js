
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
    from coa
    where is_active is true
    order by account_code asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from coa
    where is_active is true
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
  from coa
  where is_active is true
  and account_id = $1
  `, [id]);
}

const updateAccount = async (id, data) => {
  const { db, pgpHelpers } = dbLib;
  console.log('dataaaa', data);
  
  const updateSql = pgpHelpers.update(data, null, 'coa') + `where account_id = $1`;
  // console.log(updateSql)
  return db.none(updateSql, [id]);
}

const createAccount = async (data) => {
  const { db, pgpHelpers } = dbLib;

  const sql = pgpHelpers.insert(data, null, 'coa');
  console.log('sqlll', sql);
  return db.oneOrNone(sql);
}

const listOpeningBalance = async (page, pageSize) => {
  const { db } = dbLib;
  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $1 offset $2`;
  }

  const data =  await db.query(`
    select c.*, jd.*
    from coa c
    left join journal_detail jd on jd.account_id = c.account_id
    left join journal_header jh on jh.journal_id = jd.journal_id
    where is_active is true and jh.is_opening_balance is true
    order by account_code asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from coa c
    left join journal_detail jd on jd.account_id = c.account_id
    left join journal_header jh on jh.journal_id = jd.journal_id
    where is_active is true and jh.is_opening_balance is true
  `);

  return {
    data,
    count: count.total
  }
}

const updateOpeningBalance = async (id, data) => {
  const { db, pgpHelpers } = dbLib;
  console.log('dataaaa', data);
  
  const updateSql = pgpHelpers.update(data, null, 'journal_detail') + `where journal_detail_id = $1`;
  // console.log(updateSql)
  return db.none(updateSql, [id]);
}

module.exports = {
  list,
  getAccountDetail,
  updateAccount,
  createAccount,
  listOpeningBalance,
  updateOpeningBalance
}