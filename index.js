const fastify = require('fastify')({
  logger: true
})
const multipart = require('@fastify/multipart');
const fp = require('fastify-plugin');
const router = require('./router/router');
const accountRoute = require('./router/account-route');
const contactRoute = require('./router/contact-route');
const journalRoute = require('./router/journal-route');
const { migrateDb } = require('./lib/db');

// file uploads
fastify.register(multipart, {
  limits: {
    // fieldNameSize: 100, // Max field name size in bytes
    // fieldSize: 100,     // Max field value size in bytes
    // fields: 10,         // Max number of non-file fields
    fileSize: 100000000,  // For multipart forms, the max file size in bytes
    // files: 1,           // Max number of file fields
    // headerPairs: 2000,  // Max number of header key=>value pairs
    // parts: 1000         // For multipart forms, the max number of parts (fields + files)
  }
});

fastify.register(require('./plugins/jwt'));

// Router
fastify.register(router);
fastify.register(accountRoute, { prefix: '/accounts'})
fastify.register(contactRoute, { prefix: '/contacts'})
fastify.register(journalRoute, { prefix: '/journals'})

//cross-origin
fastify.register(require('@fastify/cors'), {
  origin: '*',
});

/**
 * Works as a body-parser for request body
 */
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  try {
    const json = JSON.parse(body);
    done(null, json);
  } catch (err) {
    err.statusCode = 400;
    done(err, undefined);
  }
});

// migrate database
// migrateDb();

// Run the server!
fastify.listen({ port: 8080 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
})