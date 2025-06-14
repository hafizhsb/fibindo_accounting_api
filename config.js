const config = {
  PORT: 8181,
  ORIGIN: process.env.ORIGIN || '*',
  JWT_KEY: process.env.JWT_KEY || 'jwtsecret',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'fibindo_user',
  DB_PWD: process.env.DB_PWD || 'admin',
  DB_NAME: process.env.DB_NAME || 'fibindo_accounting',
  DB_PORT: process.env.DB_PORT || 5432,
  POOL_SIZE: process.env.POOL_SIZE || 50,
  POOL_IDLE_TIMEOUT: process.env.POOL_IDLE_TIMEOUT || 60000,
  ENV: process.env.ENV || 'development',
  SMTP_HOST: process.env.SMTP_HOST || 'mail.fibindo.co.id',
  SMTP_PORT: process.env.SMTP_PORT || '465',
  SMTP_USER: process.env.SMTP_USER || 'no-reply@fibindo.co.id',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || 'fibindo@1234',
  SITE_URL: process.env.SITE_URL || 'https://fibindo.co.id',
  // AWS
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'test',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'pass',
  AWS_S3_REGION: process.env.AWS_S3_REGION || 'ap-southeast-1',
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || 'fibindo',

}

module.exports = config;
