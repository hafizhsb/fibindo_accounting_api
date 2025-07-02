
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

const getJournalDetail = async (req) => {
  const { id } = req.params;
  const { schemaName  } = req.user;
  const { db } = dbLib;
  return db.oneOrNone(`
  select *,
  (select sum(debit) from ${schemaName}.journal_detail where journal_id = jh.journal_id ) as debit,
  (select sum(credit) from ${schemaName}.journal_detail where journal_id = jh.journal_id ) as credit,
  (select array_to_json(array_agg(d))
    from (
      select jd.*, c.contact_name, coa.account_name
      from ${schemaName}.journal_detail jd
      left join ${schemaName}.contact c on c.contact_id = jd.contact_id
      left join ${schemaName}.coa on coa.account_id = jd.account_id
      where jd.journal_id = jh.journal_id
    ) d
  ) as items
  from ${schemaName}.journal_header jh
  where jh.journal_id = $1
  `, [id]);
}

const createJournal = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { body: data } = req;
  const { schemaName  } = req.user;

  return db.tx(async (trx) => {
    const sqlJH = pgpHelpers.insert({
      transaction_date: data.transaction_date,
      notes: data.notes,
      created_date: 'now()',
      journal_no: data.journal_no,
      source_doc_no: data.source_doc_no,
      journal_attachment_url: data.journal_attachment_url
    }, null, { table: 'journal_header', schema: schemaName }) + ' RETURNING journal_id';
    const { journal_id } = await trx.oneOrNone(sqlJH);

    const details = data.items;
    details.forEach((detail) => {
      detail.journal_id =  journal_id;
    });
    const sqlJD =  pgpHelpers.insert(details, ['account_id', 'journal_id', 'debit', 'credit', 'contact_id'], { table: 'journal_detail', schema: schemaName })

    await trx.none(sqlJD);
  })
}

const updateJournal = async (req) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = req.params;
  const { body: data } = req;
  const { schemaName  } = req.user;

  return db.tx(async (trx) => {
    const sqlJH = pgpHelpers.update({
      transaction_date: data.transaction_date,
      notes: data.notes,
      created_date: 'now()',
      journal_no: data.journal_no,
      source_doc_no: data.source_doc_no,
      journal_attachment_url: data.journal_attachment_url
    }, null, { table: 'journal_header', schema: schemaName })  + ` where journal_id = $1`;
    await trx.oneOrNone(sqlJH, [id]);

    // delete old transaction
    trx.query(`delete from ${schemaName}.journal_detail where journal_id = $1`, [id]);

    const details = data.items;
    details.forEach((detail) => {
      detail.journal_id =  id;
    });
    const sqlJD =  pgpHelpers.insert(details, ['account_id', 'journal_id', 'debit', 'credit', 'contact_id'], { table: 'journal_detail', schema: schemaName });
    console.log('sqlJD', sqlJD);

    await trx.none(sqlJD);
  })
}

module.exports = {
  list,
  getJournalDetail,
  updateJournal,
  createJournal
}