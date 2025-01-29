const fp = require("fastify-plugin")

module.exports = fp(async function(fastify, opts, done) {
  fastify.register(require("@fastify/jwt"), {
    secret: "supersecret",
    sign: {
      expiresIn: '240h'
    }
  })

  fastify.decorate("authenticate", async function(request, reply) {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  });

  done();
})