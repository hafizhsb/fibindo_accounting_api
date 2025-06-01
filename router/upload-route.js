const Joi = require('joi')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { createHash } = require('crypto');
const config = require('../config');
const { successRes, errorRes } = require('../plugins/reply');

module.exports = async function(fastify, opts) {
  fastify.post('/s3',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { schemaName  } = req.user;
      const s3 = new S3Client({
        region: config.AWS_S3_REGION,
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY
      });

      const data = await req.file();
      let fileName = data.filename;
      if (fileName) {
        fileName = generateFileName(fileName, schemaName);
      }
      const putObjectCommand = new PutObjectCommand({
        Bucket: config.AWS_S3_BUCKET, 
        Key: fileName,
        Body: await data.toBuffer(),
        ContentType: data.mimetype,
      });

      await s3.send(putObjectCommand);

      const fileUrl = getUrlFromBucket(fileName)

      reply.send(successRes({file_url: fileUrl}))
    } catch (err) {
      console.log('err upload files', err);
      throw err;
    }
  })

  function generateFileName(fileName, schemaName) {
    const name = `${new Date().getTime()}_${Math.floor(Date.now() / 1000)}_${fileName}_${schemaName}`;
    console.log(name)
    const hashedName = createHash('sha256').update(name).digest('hex');
    console.log(hashedName)
    return hashedName;
  }

  function getUrlFromBucket(fileName) {
    return `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_S3_REGION}.amazonaws.com/${fileName}`
};
}