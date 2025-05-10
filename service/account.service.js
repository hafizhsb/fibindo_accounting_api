
const pgp = require('pg-promise');
const config = require('../config');
const dbLib = require('../lib/db');
const { date } = require('joi');

const list = async (req, page, pageSize) => {
  const { db } = dbLib;
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
    from ${schemaName}.coa c
    left join ${schemaName}.account_header ah on ah.account_header_id = c.account_header_id
    where c.is_active is true
    order by account_code asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from ${schemaName}.coa c
    join ${schemaName}.account_header ah on ah.account_header_id = c.account_header_id
    where ah.is_active is true and c.is_active is true
  `);

  return {
    data,
    count: count.total
  }
}

const getAccountDetail = async (req) => {
  const { id } = req.params;
  const { schemaName  } = req.user;
  const { db } = dbLib;
  return db.oneOrNone(`
  select *
  from ${schemaName}.coa c
  join ${schemaName}.account_header ah on ah.account_header_id = c.account_header_id
  where ah.is_active is true and c.is_active is true
  and account_id = $1
  `, [id]);
}

const updateAccount = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { body } = req;
  const data = {
    account_code: body.account_code,
    account_name: body.account_name,
    account_header_id: body.account_header_id,
    bank_id: body.bank_id,
    normal_balance: body.normal_balance,
    statement_type: body.statement_type,
    is_active: body.is_active
  };
  const { schemaName  } = req.user;
  console.log('dataaaa', data);
  
  const updateSql = pgpHelpers.update(data, null, { table: 'coa', schema: schemaName }) + ` where account_id = $1`;
  // console.log(updateSql)
  return db.none(updateSql, [id]);
}

const createAccount = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { body } = req;
  const data = {
    account_code: body.account_code,
    account_name: body.account_name,
    account_header_id: body.account_header_id,
    bank_id: body.bank_id,
    normal_balance: body.normal_balance,
    statement_type: body.statement_type,
    is_active: body.is_active,
    opening_balance: body.opening_balance
  };
  const { schemaName  } = req.user;

  const openingBalance = data.opening_balance || 0;
  delete data.opening_balance;

  const sql = pgpHelpers.insert(data, null, { table: 'coa', schema: schemaName })  + ' RETURNING account_id';;
  console.log('sqlll', sql);
  return db.tx(async (trx) => {
    const { account_id } = await trx.oneOrNone(sql);

    const cj = await checkJournal(trx, schemaName);
    if (cj.length === 0) {
      await insertJournal(trx, schemaName);
    }

    // create opening balance
    const ob = {
      account_id,
      debit: data.normal_balance === 1 ? openingBalance : 0,
      credit: data.normal_balance === 2 ? openingBalance : 0,
      journal_id: -1,
      description: 'Saldo Awal'
    }
    trx.query(pgpHelpers.insert(ob, null, { table: 'journal_detail', schema: schemaName }))
  })
}

const deleteAccount = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { schemaName  } = req.user;
  const data = {
    is_active: false
  }
  const updateSql = pgpHelpers.update(data, null, { table: 'coa', schema: schemaName }) + ` where account_id = $1`;
  return db.none(updateSql, [id]);
}

// Account Header
const listAccountHeader = async (req, page, pageSize) => {
  const { db } = dbLib;
  const { schemaName  } = req.user;
  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $1 offset $2`;
  }
  console.log(`select *
    from ${schemaName}.account_header
    where is_active is true
    order by account_code asc`)
  const data =  await db.query(`
    select *
    from ${schemaName}.account_header
    where is_active is true
    order by account_header_code asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from ${schemaName}.account_header
    where is_active is true
  `);

  return {
    data,
    count: count.total
  }
}

const createAccountHeader = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { body } = req;
  const data = body;
  const { schemaName  } = req.user;

  const sql = pgpHelpers.insert(data, null, { table: 'account_header', schema: schemaName });
  console.log('sqlll', sql);
  return db.oneOrNone(sql);
}

const getDetailAccountHeader = async (req) => {
  const { id } = req.params;
  const { db } = dbLib;
  const { schemaName } = req.user;
  return db.oneOrNone(`select * from ${schemaName}.account_header ah where ah.account_header_id = $1`, [id]);
};

const updateAccountHeader = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { body } = req;
  const data = body;
  const { schemaName  } = req.user;
  console.log('dataaaa', data);
  
  const updateSql = pgpHelpers.update(data, null, { table: 'account_header', schema: schemaName }) + ` where account_header_id = $1`;
  console.log('updateSql', updateSql)
  return db.none(updateSql, [id]);
}

const deleteAccountHeader = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { schemaName  } = req.user;
  const data = {
    is_active: false
  }
  const updateSql = pgpHelpers.update(data, null, { table: 'account_header', schema: schemaName }) + ` where account_header_id = $1`;
  return db.none(updateSql, [id]);
}


// Opening Balance
const listOpeningBalance = async (req) => {
  const { db } = dbLib;
  const { page, page_size } = req.query;
  const pageSize = page_size;
  const { schemaName  } = req.user;
  let limit = pageSize && parseInt(pageSize) || 10;
  let offset = 0;
  let limitQuery = '';
  if (page && pageSize) {
    offset = (page - 1) * pageSize;
    limitQuery = `limit $1 offset $2`;
  }

  const data =  await db.query(`
    select c.*, jd.*
    from ${schemaName}.coa c
    left join ${schemaName}.journal_detail jd on jd.account_id = c.account_id
    left join ${schemaName}.journal_header jh on jh.journal_id = jd.journal_id
    where is_active is true and jh.is_opening_balance is true
    order by account_code asc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from ${schemaName}.coa c
    left join ${schemaName}.journal_detail jd on jd.account_id = c.account_id
    left join ${schemaName}.journal_header jh on jh.journal_id = jd.journal_id
    where is_active is true and jh.is_opening_balance is true
  `);

  return {
    data,
    count: count.total
  }
}

const updateOpeningBalance = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { body } = req;
  const { schemaName  } = req.user;
  
  const updateSql = pgpHelpers.update(body, null, { table: 'journal_detail', schema: schemaName }) + `where journal_detail_id = $1`;
  // console.log(updateSql)
  return db.none(updateSql, [id]);
}

function checkJournal(trx, schemaName) {
  return trx.query(`select journal_id
    from ${schemaName}.journal_header
    where journal_id = -1`);
}

function insertJournal(trx, schemaName) {
  return trx.query(`INSERT INTO ${schemaName}.journal_header
    (
      journal_id,transaction_date,created_date,source_doc_no,notes,is_opening_balance
    )
    VALUES
    (-1,now(),now(),'_JRN-BB_','Saldo Awal Akun',true);`);
}

module.exports = {
  list,
  getAccountDetail,
  updateAccount,
  createAccount,
  listAccountHeader,
  createAccountHeader,
  updateAccountHeader,
  listOpeningBalance,
  updateOpeningBalance,
  getDetailAccountHeader,
  deleteAccount,
  deleteAccountHeader
}