const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const contactService = require('../service/contact.service');

module.exports = async function(fastify, opts) {
  fastify.get('/',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { data, count} = await contactService.list(req);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get('/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const row = await accountService.getAccountDetail(req)
      reply.send(successRes(row))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.post('/',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await contactService.createContact(req);
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await contactService.updateContact(req)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}