const pgp = require('pg-promise')();
const config = require('../config');
const Knex = require('knex');

const systemDbCn = {
  user: config.DB_USER,
  database: config.DB_NAME,
  port: parseInt(config.DB_PORT, 10),
  host: config.DB_HOST,
  password: config.DB_PWD,
  poolSize: parseInt(config.POOL_SIZE, 10),
  max: parseInt(config.POOL_SIZE, 10),
  idleTimeoutMillis: parseInt(config.POOL_IDLE_TIMEOUT, 10)
};

const db = pgp(systemDbCn);
const pgpHelpers = pgp.helpers;

const migrateDb = async function () {
  try {
    const knex = Knex({
      client: 'pg',
      connection: {
        host : config.DB_HOST,
        user : config.DB_USER,
        password : config.DB_PWD,
        database : config.DB_NAME,
        port: config.DB_PORT
      }
    });
  
    console.log('migrating system db to latest version...');
    await knex.migrate.latest({
      directory: 'migrations',
    });
    console.log('system db migration completed');
    return true;
  } catch (err) {
    console.log(err);
  }
}

module.exports = {
  db,
  pgpHelpers,
  migrateDb
};