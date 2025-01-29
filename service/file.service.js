
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

const upload = async (request) => {
  const { db, pgpHelpers } = dbLib;
  try {
    const parts = request.parts();
    let file;
    let fileName;
    let ff;
    
    for await (const part of parts) {
      if (part.type === 'file') {
        // file = part.file;
        // console.log('partts', part)
        const split = part.filename.split('.');
        ext = split.slice(-1)
        console.log('fileNameeeee', fileName);
        const name = `${Math.floor(Date.now() / 1000)}-${slugify(fileName)}.${ext}`;
        ff = name;
        await pump(part.file, fs.createWriteStream(`./uploads/${name}`))
      } else {
        fileName = part.value;
      }
    }
    

    const payload = {
      file_name: fileName,
      file: ff,
    }
    console.log('payloaddd', payload);
    const sql = pgpHelpers.insert(payload, null, 'files');
    return db.none(sql);
  } catch (err) {
    throw err
  }
  
}

module.exports = {
  upload
}