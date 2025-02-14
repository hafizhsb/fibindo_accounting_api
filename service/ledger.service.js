
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');

const getLedger = async (req) => {
  const { db } = dbLib;
  const { id } = req.params;
  const { page, page_size: pageSize } = req.query;
  const { schemaName  } = req.user;

  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $2 offset $3`;
  }

  const data =  await db.query(`
    select *, sum(case when c.normal_balance = 1 then balance else (balance * -1) end) OVER (order by am.acct_movement_id) total 
    from ${schemaName}.acct_movement am
    join ${schemaName}.coa c on c.account_id  = am.account_id 
    where am.account_id = $1
  `, [id]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from ${schemaName}.acct_movement am
    join ${schemaName}.coa c on c.account_id  = am.account_id
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