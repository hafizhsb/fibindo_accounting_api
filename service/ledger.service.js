
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');

const getLedger = async (id, page, pageSize) => {
  const { db } = dbLib;
  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $2 offset $3`;
  }

  const data =  await db.query(`
    select *, sum(case when c.normal_balance = 1 then balance else (balance * -1) end) OVER (order by am.acct_movement_id) total 
    from acct_movement am
    join coa c on c.account_id  = am.account_id 
    where am.account_id = $1
  `, [id]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from acct_movement am
    join coa c on c.account_id  = am.account_id
    where am.account_id = $1
  `, [id]);

  return {
    data,
    count: count.total
  }
}

module.exports = {
  getLedger
}