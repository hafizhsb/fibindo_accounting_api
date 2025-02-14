
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
    select jh.*, 
    lpad(jh.journal_id::varchar(50), 10,
      'GJ' || '-0000000000'
    ) as journal_no,
    (select sum(debit) from ${schemaName}.journal_detail where journal_id = jh.journal_id ) as debit,
    (select sum(credit) from ${schemaName}.journal_detail where journal_id = jh.journal_id ) as credit
    from ${schemaName}.journal_header jh
    order by transaction_date desc
    ${limitQuery}
  `, [limit, offset]);

  const count = await db.oneOrNone(`
    select count(*)::int total
    from ${schemaName}.journal_header
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

const createJournal = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { body: data } = req;
  const { schemaName  } = req.user;

  const sql = pgpHelpers.insert(data, null, 'contact');
  return db.tx(async (trx) => {
    const sqlJH = pgpHelpers.insert({
      transaction_date: data.transaction_date,
      notes: data.notes,
      created_date: 'now()'
    }, null, { table: 'journal_header', schema: schemaName }) + ' RETURNING journal_id';
    const { journal_id } = await trx.oneOrNone(sqlJH);

    const details = data.items;
    details.forEach((detail) => {
      detail.journal_id =  journal_id;
    });
    const sqlJD =  pgpHelpers.insert(details, ['account_id', 'journal_id', 'debit', 'credit', 'notes'], { table: 'journal_detail', schema: schemaName })

    await trx.none(sqlJD);
  })
}

module.exports = {
  list,
  getAccountDetail,
  updateContact,
  createJournal
}