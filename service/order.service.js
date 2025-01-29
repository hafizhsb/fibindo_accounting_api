const fs = require('fs');
const util = require('util');
const { pipeline } = require('stream');
const pump = util.promisify(pipeline)
const { send } = require('../lib/mail');

const config = require('../config');
const dbLib = require('../lib/db');
const { generateTransactionNumber, generateInvoiceNumber, slugify } = require('../lib/utils');
const { generateInternalToken } = require('../lib/auth');

const create = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  const { body } = request;

  try  {
    console.log({email});
    console.log({body});
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }
    await db.tx(async (trx) => {
      // save orders
      body.member_id = member.id;
      body.created_at = 'now()';
      body.order_status = 'Draft';

      const sqlOrder = pgpHelpers.insert(body, null, 'orders') + ' RETURNING order_id';
      const { order_id } = await trx.oneOrNone(sqlOrder);

      // generate order number
      const { curr_val } = await trx.one(`select currval('orders_order_id_seq') as curr_val`)
      const orderNo = generateTransactionNumber(curr_val, body.doc_type);
      console.log('orderr no', orderNo);
      const updateOrderSql = pgpHelpers.update({order_no: orderNo }, null, 'orders') + ' where order_id = $1';
      await trx.none(updateOrderSql, [order_id]);
    })
  } catch (err) {
    throw err
  }
}

const update = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  const { id } = request.params;
  const { body } = request;
  
  
  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const sqlOrderData = pgpHelpers.update(body, null, 'orders') + `where order_id = $1`;
    return db.oneOrNone(sqlOrderData, [id]);
  } catch (err) {
    throw err
  }
}

const list = async (request, type) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;

  const member = await db.oneOrNone('select id from member where email = $1', [email]);
  if (!member) {
    throw new Error('Email tidak terdaftar');
  }

  let where = '';
  if (type === 'certificate') {
    where = 'and certificate is not null';
  }
  console.log(`select *
    from orders o
    left join product p on p.product_id = o.product_id
    left join company c on c.company_id = o.company_id
    where o.member_id = $1
    ${where}
    order by created_at desc`)
  return db.query(`select *
    from orders o
    left join product p on p.product_id = o.product_id
    left join company c on c.company_id = o.company_id
    where o.member_id = $1
    ${where}
    order by created_at desc`, [member.id])
}

const listAdmin = async (request) => {
  const { db, pgpHelpers } = dbLib;

  const data = await db.query(`select o.*, p.product_name, cd.company_name, m.email, m.fullname
    from orders o
    left join product p on p.product_id = o.product_id
    left join company c on c.company_id = o.company_id
    left join company_data cd on cd.company_id = o.company_id
    left join member m on m.id = c.member_id
    order by created_at desc`)

  const count = await db.query(`select count(*)::int
    from orders o`)

  return {
    data,
    count
  }
}

const detail = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email, role } = request.user;
  const { id } = request.params;
  let memberId;

  let where = 'where o.order_id = $1'

  if (role !== 'admin') {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }
    memberId = member.id;
    where = 'where o.order_id = $1 and o.member_id = $2';
  }
  const order = await db.oneOrNone(`select o.*, p.product_name, cd.*, m.fullname, m.email,
  concat_ws(', ', coalesce(cd.address, ''), coalesce(a.area_name, ''), coalesce(s.suburb_name, '')
    , coalesce(ct.city_name, ''), coalesce(pr.province_name, ''), coalesce(cn.country_name, '')) full_address,
  ont.*, oi.invoice_no, oi.order_price, oi.invoice_status, oi.invoice_date, oi.file as invoice_file, oet.*, ocg.*
  from orders o
  left join member m on m.id = o.member_id
  left join product p on p.product_id = o.product_id
  left join company c on c.company_id = o.company_id
  left join company_data cd on cd.company_id = c.company_id
  left join countries cn on cn.country_id = cd.citizenship
  left join provinces pr on pr.province_id = cd.province
  left join cities ct on ct.city_id = cd.city
  left join suburbs s on s.suburb_id = cd.district
  left join areas a on a.area_id = cd.area
  left join orders_notes ont on ont.order_id = o.order_id
  left join orders_invoice oi on oi.order_id = o.order_id
  left join orders_external_link oet on oet.order_id = o.order_id
  left join orders_cargo ocg on ocg.order_id = o.order_id
  ${where}
  --order by o.created_at desc`, [id, memberId]);

  const settings = await db.oneOrNone('select net_premi, policy_cost from settings');
  order.net_premi = settings.net_premi;
  order.policy_cost = settings.policy_cost;
  order.invoice_total = parseFloat(order.order_price) + parseFloat(settings.net_premi) + parseFloat(settings.policy_cost);

  return order;
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

const updateDoc = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  
  
  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const memberId = member.id;

    const parts = request.parts();
    let orderId;
    let orderFiles = {};
    
    for await (const part of parts) {
      console.log('partttt', part.fieldname, part.filename, part.value);
      if (['surety_file', 'other_doc_file'].includes(part.fieldname)) {
        const split = part.filename.split('.');
        ext = split.slice(-1)
        // console.log('fileNameeeee', fileName);
        const name = `${Math.floor(Date.now() / 1000)}-${memberId}-${slugify(part.fieldname)}.${ext}`;
        console.log('nameee', name)
        orderFiles[part.fieldname] = name;
        await pump(part.file, fs.createWriteStream(`./uploads/${name}`))
      } else {
        orderId = part.value;
      }
    }

    console.log('orderFiles', orderFiles)
    console.log('orderId', orderId)
    return db.none(`update orders
      set surety_file = $1, other_doc_file = $2, order_status = 'On Review'
      where order_id = $3 and member_id = $4`, [orderFiles.surety_file, orderFiles.other_doc_file, orderId, memberId])

  } catch (err) {
    throw err
  }
}

const notes = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { body, params } = request;
  const { id } = params;
  
  try {
    console.log(id, body);
    const exists = await db.oneOrNone('select * from orders_notes where order_id = $1', [id]);
    console.log(exists);
    if (exists) {
      await db.query('update orders_notes set note = $1 where order_id = $2', [body.notes, id])
    } else {
      await db.query('insert into orders_notes (order_id, note, created_at) values ($1, $2, $3)', [id, body.notes, 'now()'])
    }
    await db.query(`update orders set order_status = 'REJECT_WITH_NOTES' where order_id = $1`, [id]);
  } catch (err) {
    throw err
  }
}

const createInvoice = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { body, params } = request;
  const { id } = params;
  
  try {
    console.log(id, body);
    const exists = await db.oneOrNone('select * from orders_invoice where order_id = $1', [id]);
    console.log(exists);
    if (exists) {
      await db.query('update orders_invoice set order_price = $1 where order_id = $2', [body.price, id])
    } else {
      await db.tx(async (trx) => {
        const { orders_invoice_id } = await trx.oneOrNone('insert into orders_invoice (order_id, order_price, invoice_date) values ($1, $2, $3) returning orders_invoice_id', [id, body.price, 'now()']);

        // generate invoice number
        const { curr_val } = await trx.one(`select currval('orders_invoice_orders_invoice_id_seq') as curr_val`)
        const orderNo = generateInvoiceNumber(curr_val);
        console.log('invoice no', orderNo, orders_invoice_id);
        const updateOrderSql = pgpHelpers.update({invoice_no: orderNo }, null, 'orders_invoice') + ' where orders_invoice_id = $1';
        await trx.none(updateOrderSql, [orders_invoice_id]);
      })
    }
    await db.query(`update orders set order_status = 'WAITING_PAYMENT' where order_id = $1`, [id]);
  } catch (err) {
    throw err
  }
}

const sendEmail = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = request.params;
  
  try {
    const exists = await db.oneOrNone('select * from orders_external_link where order_id = $1', [id]);
    const order = await db.oneOrNone(`select o.*, p.product_name, cd.company_name, cd.company_prefix from orders o 
      join product p on p.product_id = o.product_id
      join company_data cd on cd.company_id = o.company_id
      where order_id = $1`, [id])
    console.log(exists);
    console.log(order);
    const setting = await db.oneOrNone('select * from settings');
    const email = setting.insurance_email;
    const token = generateInternalToken(email);
    const link = `https://fibindo.co.id/external-doc/${token}`;

    if (!exists) {
      await db.query('insert into orders_external_link (order_id, link, token, created_at) values ($1, $2, $3, $4)', [id, link, token, 'now()']);

      // send email
      const content = `<p>Selamat Pagi, </p>
      <p>Berikut kami informasikan pengajuan dari fibindo.co.id - Lisensi AAUI: 20240113.A01-000000004</p>
      <p>Link Dokumen :  ${link}</p>
      <br /><p>Mohon untuk dilakukan proses underwriting dan informasi biaya untuk ditagihkan kepada ${order.company_prefix}. ${order.company_name}.</p>
      <br />
      <p>Terima Kasih</p>`;
      console.log('send email to', email)
      await send(email, `Dokumen ${order.product_name}`, content);
      console.log('send email to', email, 'success')
    }
  } catch (err) {
    throw err
  }
}

const invoice = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email, role } = request.user;
  const { id } = request.params;
  let memberId;

  let where = 'where o.order_id = $1'

  if (role !== 'admin') {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }
    memberId = member.id;
    where = 'where o.order_id = $1 and o.member_id = $2';
  }
  const order = await db.oneOrNone(`select o.*, p.product_name, cd.*, m.fullname, m.email,
  concat_ws(', ', coalesce(cd.address, ''), coalesce(a.area_name, ''), coalesce(s.suburb_name, '')
    , coalesce(ct.city_name, ''), coalesce(pr.province_name, ''), coalesce(cn.country_name, '')) full_address,
  ont.*, oi.invoice_no, oi.order_price, oi.invoice_status, oi.invoice_date, oi.due_date, oi.file as invoice_file, pr.*, ct.*, s.*, a.*
  from orders o
  left join member m on m.id = o.member_id
  left join product p on p.product_id = o.product_id
  left join company c on c.company_id = o.company_id
  left join company_data cd on cd.company_id = c.company_id
  left join countries cn on cn.country_id = cd.citizenship
  left join provinces pr on pr.province_id = cd.province
  left join cities ct on ct.city_id = cd.city
  left join suburbs s on s.suburb_id = cd.district
  left join areas a on a.area_id = cd.area
  left join orders_notes ont on ont.order_id = o.order_id
  left join orders_invoice oi on oi.order_id = o.order_id
  ${where}
  --order by o.created_at desc`, [id, memberId])

  const settings = await db.oneOrNone('select net_premi, policy_cost from settings');
  order.net_premi = settings.net_premi;
  order.policy_cost = settings.policy_cost;
  order.invoice_total = parseFloat(order.order_price) + parseFloat(settings.net_premi) + parseFloat(settings.policy_cost);
  return order;
}

const getExternalDoc = async (request) => {
  const { db } = dbLib;
  const { token } = request.params;

  const externalLink = await db.oneOrNone('select * from orders_external_link where token = $1 and expired_at > now()', [token])
  if (!externalLink) {
    return;
  }
  const orderId = externalLink.order_id;
  let where = 'where o.order_id = $1'

  const order = await db.oneOrNone(`select o.*, p.product_name, cd.*, m.fullname, m.email,
  concat_ws(', ', coalesce(cd.address, ''), coalesce(a.area_name, ''), coalesce(s.suburb_name, '')
    , coalesce(ct.city_name, ''), coalesce(pr.province_name, ''), coalesce(cn.country_name, '')) full_address,
  ont.*, oi.invoice_no, oi.order_price, oi.invoice_status, oi.invoice_date, pr.*, ct.*, s.*, a.*,
  (
    select array_to_json(coalesce(array_agg(row), '{}'))
    from (
        select * from company_financial_statement cfs
        where cfs.company_id = c.company_id
        order by company_financial_statement_id asc
    ) row
  ) company_financial,
  (
    select array_to_json(coalesce(array_agg(row), '{}'))
    from (
        select * from company_administrator ca
        where ca.company_id = c.company_id
        order by company_administrator_id asc
    ) row
  ) company_administrator,
  (
    select array_to_json(coalesce(array_agg(row), '{}'))
    from (
        select * from company_track_record ctr
        where ctr.company_id = c.company_id
        order by company_track_record_id asc
    ) row
  ) company_track_record
  from orders o
  left join member m on m.id = o.member_id
  left join product p on p.product_id = o.product_id
  left join company c on c.company_id = o.company_id
  left join company_data cd on cd.company_id = c.company_id
  left join countries cn on cn.country_id = cd.citizenship
  left join provinces pr on pr.province_id = cd.province
  left join cities ct on ct.city_id = cd.city
  left join suburbs s on s.suburb_id = cd.district
  left join areas a on a.area_id = cd.area
  left join orders_notes ont on ont.order_id = o.order_id
  left join orders_invoice oi on oi.order_id = o.order_id
  ${where}
  --order by o.created_at desc`, [orderId])

  const settings = await db.oneOrNone('select net_premi, policy_cost from settings');
  order.net_premi = settings.net_premi;
  order.policy_cost = settings.policy_cost;
  return order;
}

const uploadInvoice = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = request.params;
  const { email } = request.user;

  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const parts = request.parts();
    let fileName;
    
    for await (const part of parts) {
      const split = part.filename.split('.');
      ext = split.slice(-1)
      fileName = `invoice-${Math.floor(Date.now() / 1000)}.${ext}`;
      await pump(part.file, fs.createWriteStream(`./uploads/${fileName}`))
    }
    
    return db.none(`update orders_invoice
      set file = $1
      where order_id = $2`, [fileName, id]);
    // const sql = pgpHelpers.insert(payload, null, 'files');
    // return db.none(sql);
  } catch (err) {
    throw err
  }
  
}

const setAsPaid = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = request.params;
  
  try {
    await db.query(`update orders set order_status = 'PAID' where order_id = $1`, [id]);
    return db.query(`update orders_invoice set invoice_status = 'PAID' where order_id = $1`, [id]);
  } catch (err) {
    throw err
  }
}

const uploadCertificate = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { id } = request.params;
  const { email } = request.user;

  try {

    const parts = request.parts();
    let fileName;
    
    for await (const part of parts) {
      const split = part.filename.split('.');
      ext = split.slice(-1)
      fileName = `certificate-${Math.floor(Date.now() / 1000)}.${ext}`;
      await pump(part.file, fs.createWriteStream(`./uploads/${fileName}`))
    }
    
    return db.none(`update orders
      set certificate = $1
      where order_id = $2`, [fileName, id]);
    // const sql = pgpHelpers.insert(payload, null, 'files');
    // return db.none(sql);
  } catch (err) {
    throw err
  }
}

const saveSingleCargo = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  let orderId;

  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const memberId = member.id;

    const parts = request.parts();
    let orderData = {};
    
    for await (const part of parts) {
      console.log('partttt', part.fieldname, part.filename, part.value);
      if (['required_document', 'policy_document'].includes(part.fieldname)) {
        const split = part.filename.split('.');
        ext = split.slice(-1)
        // console.log('fileNameeeee', fileName);
        const name = `${Math.floor(Date.now() / 1000)}-${memberId}-${slugify(part.fieldname)}.${ext}`;
        console.log('nameee', name)
        orderData[part.fieldname] = name;
        await pump(part.file, fs.createWriteStream(`./uploads/${name}`))
      } else {
        orderData[part.fieldname] = part.value;
      }
    }

    console.log('orderData', orderData);
    const orderType = orderData.cargo_type === 'open_cover' ? 'Open Cover Shipment' : 'Single Shipment';
    const productId = orderData.cargo_type === 'open_cover' ? 1320 : 1310;
    delete orderData.cargo_type;

    await db.tx(async (trx) => {
      // save orders
      const dataOrder = {
        member_id: member.id,
        created_at: 'now()',
        order_status: 'Draft',
        product_id: productId
      }
      

      const sqlOrder = pgpHelpers.insert(dataOrder, null, 'orders') + ' RETURNING order_id';
      const { order_id } = await trx.oneOrNone(sqlOrder);
      orderId = order_id;
      // generate order number
      const { curr_val } = await trx.one(`select currval('orders_order_id_seq') as curr_val`)
      const orderNo = generateTransactionNumber(curr_val, orderType);
      console.log('orderr no', orderNo);
      const updateOrderSql = pgpHelpers.update({order_no: orderNo }, null, 'orders') + ' where order_id = $1';
      await trx.none(updateOrderSql, [order_id]);

      // save single cargo 1
      orderData.order_id = order_id;
      const sqlOrderCargo = pgpHelpers.insert(orderData, null, 'orders_cargo');
      return trx.oneOrNone(sqlOrderCargo);
    })
    return {
      order_id: orderId
    }
  } catch (err) {
    throw err
  }
}

const updateSingleCargo = async (request) => {
  const { db, pgpHelpers } = dbLib;
  const { email } = request.user;
  const { id } = request.params;
  const parts = request.parts();

  try {
    const member = await db.oneOrNone('select id from member where email = $1', [email]);
    if (!member) {
      throw new Error('Email tidak terdaftar');
    }

    const memberId = member.id;
    let orderData = {};
    
    for await (const part of parts) {
      console.log('partttt', part.fieldname, part.filename, part.value);
      if (['policy_document', 'required_document'].includes(part.fieldname)) {
        const split = part.filename.split('.');
        ext = split.slice(-1)
        // console.log('fileNameeeee', fileName);
        const name = `${Math.floor(Date.now() / 1000)}-${memberId}-${slugify(part.fieldname)}.${ext}`;
        console.log('nameee', name)
        orderData[part.fieldname] = name;
        await pump(part.file, fs.createWriteStream(`./uploads/${name}`))
      } else {
        orderData[part.fieldname] = part.value;
      }
    }

    console.log('orderData', orderData)
    delete orderData.cargo_type;
    const updateOrderSql = pgpHelpers.update(orderData, null, 'orders_cargo') + ' where order_id = $1';
    await db.none(updateOrderSql, [id]);
    return {
      order_id: id
    }
  } catch (err) {
    throw err
  }
}

module.exports = {
  create,
  list,
  listAdmin,
  detail,
  submitApplication,
  update,
  updateDoc,
  notes,
  sendEmail,
  createInvoice,
  invoice,
  getExternalDoc,
  uploadInvoice,
  setAsPaid,
  uploadCertificate,
  saveSingleCargo,
  updateSingleCargo
}