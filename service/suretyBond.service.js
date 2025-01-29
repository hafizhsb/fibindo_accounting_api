
const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline)

const config = require('../config');
const dbLib = require('../lib/db');
const { slugify } = require('../lib/utils');

const extesionList = {
  'image/jpeg': '.png'
}

const save = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  
  
  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const member_id = member.id;
    const parts = request.parts();
    let file;
    let fileName;
    let ff;
    let companyAdministratorFiles = [];
    let companyData = {};
    let companyFiles = {};
    
    for await (const part of parts) {
      console.log('partttt', part.fieldname, part.filename, part.value);
      if (['f1', 'f2', 'akta', 'akta_change', 'akta_branch', 'track_record_file', 'financial_statemet_file', 'indemnity_agreement', 'spgr'].includes(part.fieldname)) {
        const split = part.filename.split('.');
        ext = split.slice(-1)
        // console.log('fileNameeeee', fileName);
        const name = `${Math.floor(Date.now() / 1000)}-${member_id}-${slugify(part.fieldname)}.${ext}`;
        console.log('nameee', name)
        if (['f1', 'f2'].includes(part.fieldname)) {
          companyAdministratorFiles.push(name)
        } else {
          companyFiles[part.fieldname] = name;
        }
        await pump(part.file, fs.createWriteStream(`./uploads/${name}`))
      } else {
        fileName = part.value;
        companyData[part.fieldname] = part.value;
      }
    }

    console.log('companyAdministratorFiles', companyAdministratorFiles)
    console.log('companyFiles', companyFiles)
    console.log('companyData', companyData)

    await db.tx(async (trx) => {
      // save orders
      const payloadOrders = {
        order_service_id: 12,
        transaction_date: 'now()',
        order_status: 'Draft',
        member_id: member_id
      }

      const sqlOrder = pgpHelpers.insert(payloadOrders, null, 'orders') + ' RETURNING order_id';
      const { order_id } = await trx.oneOrNone(sqlOrder);

      // save order data
      let orderDataPayload = JSON.parse(companyData.company_data);
      orderDataPayload.order_id = order_id;
      orderDataPayload = {...orderDataPayload, ...companyFiles}
      const sqlOrderData = pgpHelpers.insert(orderDataPayload, null, 'order_company_data');
      await trx.oneOrNone(sqlOrderData);

      // save order_company_track_record
      const orderTrackRecord = JSON.parse(companyData.company_track_record);
      orderTrackRecord.forEach((o) => {
        o.order_id = order_id;
      });

      await trx.query(pgpHelpers.insert(orderTrackRecord, ['order_id', 'job_name', 'contract_no', 'value', 'year', 'source'], 'order_company_track_record'));

      // save order_company_financial_statement
      const orderFinancial = JSON.parse(companyData.company_financial);
      orderFinancial.forEach((o) => {
        o.order_id = order_id;
      });

      await trx.query(pgpHelpers.insert(orderFinancial, ['order_id', 'asset', 'income', 'profit'], 'order_company_financial_statement'));

      // save order_company_administrator
      const orderAdministrator = JSON.parse(companyData.company_administrator);
      orderAdministrator.forEach((o, idx) => {
        o.order_id = order_id;
        o.id_card = companyAdministratorFiles[idx]
      });
      console.log('orderAdministrator', orderAdministrator);
      await trx.query(pgpHelpers.insert(orderAdministrator, ['order_id', 'name', 'position', 'share', 'id_card'], 'order_company_administrator'));
    })
  } catch (err) {
    throw err
  }
}

const update = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  
  
  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const member_id = member.id;
    const parts = request.parts();
    let companyAdministratorFiles = [];
    let companyData = {};
    let companyFiles = {};
    
    for await (const part of parts) {
      console.log('partttt', part.fieldname, part.filename, part.value);
      if (['f1', 'f2', 'akta', 'akta_change', 'akta_branch', 'track_record_file', 'financial_statemet_file', 'indemnity_agreement', 'spgr'].includes(part.fieldname)) {
        const split = part.filename.split('.');
        ext = split.slice(-1)
        // console.log('fileNameeeee', fileName);
        const name = `${Math.floor(Date.now() / 1000)}-${member_id}-${slugify(part.fieldname)}.${ext}`;
        console.log('nameee', name)
        if (['f1', 'f2'].includes(part.fieldname)) {
          companyAdministratorFiles.push(name)
        } else {
          companyFiles[part.fieldname] = name;
        }
        await pump(part.file, fs.createWriteStream(`./uploads/${name}`))
      } else {
        fileName = part.value;
        companyData[part.fieldname] = part.value;
      }
    }

    console.log('companyAdministratorFiles', companyAdministratorFiles)
    console.log('companyFiles', companyFiles)
    console.log('companyData', companyData)

    await db.tx(async (trx) => {
      const order_id = request.params.id;

      // save order data
      let orderDataPayload = JSON.parse(companyData.company_data);
      orderDataPayload.order_id = order_id;
      orderDataPayload = {...orderDataPayload, ...companyFiles}
      const sqlOrderData = pgpHelpers.update(orderDataPayload, null, 'order_company_data') + `where order_id = $1`;
      await trx.oneOrNone(sqlOrderData, [order_id]);

      // save order_company_track_record
      const orderTrackRecord = JSON.parse(companyData.company_track_record);
      orderTrackRecord.forEach((o) => {
        o.order_id = order_id;
      });

      await trx.none(`delete from order_company_track_record where order_id = $1`, [order_id])
      await trx.query(pgpHelpers.insert(orderTrackRecord, ['order_id', 'job_name', 'contract_no', 'value', 'year', 'source'], 'order_company_track_record'));

      // save order_company_financial_statement
      const orderFinancial = JSON.parse(companyData.company_financial);
      orderFinancial.forEach((o) => {
        o.order_id = order_id;
      });

      await trx.none(`delete from order_company_financial_statement where order_id = $1`, [order_id])
      await trx.query(pgpHelpers.insert(orderFinancial, ['order_id', 'asset', 'income', 'profit'], 'order_company_financial_statement'));

      // save order_company_administrator
      const orderAdministrator = JSON.parse(companyData.company_administrator);
      orderAdministrator.forEach((o, idx) => {
        o.order_id = order_id;
        o.id_card = o.old_file;
        if (companyAdministratorFiles.length > 0 && companyAdministratorFiles[idx]) {
          o.id_card = companyAdministratorFiles[idx]
        }
      });
      console.log('orderAdministrator', orderAdministrator);
      await trx.none(`delete from order_company_administrator where order_id = $1`, [order_id])
      await trx.query(pgpHelpers.insert(orderAdministrator, ['order_id', 'name', 'position', 'share', 'id_card'], 'order_company_administrator'));
    })
  } catch (err) {
    throw err
  }
}

const list = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;

  const member = await db.oneOrNone('select id from member where email = $1', [email]);
  if (!member) {
    throw new Error('Email tidak terdaftar');
  }

  return db.query(`select *,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_financial_statement ocd
          where ocd.order_id = o.order_id
          order by order_company_financial_statement_id asc
      ) row
    ) company_financial,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_administrator oca
          where oca.order_id = o.order_id
          order by order_company_administrator_id asc
      ) row
    ) company_administrator,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_track_record ocr
          where ocr.order_id = o.order_id
          order by order_company_track_record_id asc
      ) row
    ) company_track_record
    from orders o
    left join order_company_data ocd on ocd.order_id = o.order_id
    where member_id = $1
    order by transaction_date desc`, [member.id])
}

const detail = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  const { id } = request.params;

  const member = await db.oneOrNone('select id from member where email = $1', [email]);
  if (!member) {
    throw new Error('Email tidak terdaftar');
  }

  return db.oneOrNone(`select o.*, ocd.*, c.country_name, p.province_name, ct.city_name, s.suburb_name, a.area_name,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_financial_statement ocd
          where ocd.order_id = o.order_id
          order by order_company_financial_statement_id asc
      ) row
    ) company_financial,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_administrator oca
          where oca.order_id = o.order_id
          order by order_company_administrator_id asc
      ) row
    ) company_administrator,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_track_record ocr
          where ocr.order_id = o.order_id
          order by order_company_track_record_id asc
      ) row
    ) company_track_record
    from orders o
    left join order_company_data ocd on ocd.order_id = o.order_id
    left join countries c on c.country_id = ocd.citizenship
    left join provinces p on p.province_id = ocd.province
    left join cities ct on ct.city_id = ocd.city
    left join suburbs s on s.suburb_id = ocd.district
    left join areas a on a.area_id = ocd.area
    where o.order_id = $1 and member_id = $2`, [id, member.id])
}


const submitApplication = async (request) => {
  const { db } = dbLib;
  const { email } = request.user;
  const { order_id } = request.body;

  const member = await db.oneOrNone('select id from member where email = $1', [email]);
  if (!member) {
    throw new Error('Email tidak terdaftar');
  }

  const order = await db.oneOrNone(`select * from orders
    where order_id = $1 and member_id = $2`, [order_id, member.id]);

  if (!order) throw new Error('Order tidak ditemukan');

  return db.query(`update orders set order_status = 'On Review' where order_id = $1`, [order.order_id]);
}

const list2 = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;

  const member = await db.oneOrNone('select id from member where email = $1', [email]);
  if (!member) {
    throw new Error('Email tidak terdaftar');
  }

  return db.query(`select *, m.fullname, m.email,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_financial_statement ocd
          where ocd.order_id = o.order_id
          order by order_company_financial_statement_id asc
      ) row
    ) company_financial,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_administrator oca
          where oca.order_id = o.order_id
          order by order_company_administrator_id asc
      ) row
    ) company_administrator,
    (
      select array_to_json(coalesce(array_agg(row), '{}'))
      from (
          select * from order_company_track_record ocr
          where ocr.order_id = o.order_id
          order by order_company_track_record_id asc
      ) row
    ) company_track_record
    from orders o
    left join order_company_data ocd on ocd.order_id = o.order_id
    left join member m on o.member_id = m.id
    order by transaction_date desc`)
}

module.exports = {
  save,
  list,
  detail,
  submitApplication,
  update,
  list2
}