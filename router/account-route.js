const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const accountService = require('../service/account.service');

module.exports = async function(fastify, opts) {
  fastify.get('/coa',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { page, page_size } = req.query;
      const { data, count} = await accountService.list(req, page, page_size);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get('/coa/:id',
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

  fastify.post('/coa',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await accountService.createAccount(req);
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/coa/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await accountService.updateAccount(req)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  // Account Header
  fastify.get('/account-header',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { page, page_size } = req.query;
      const { data, count} = await accountService.listAccountHeader(req, page, page_size);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.post('/account-header',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await accountService.createAccountHeader(req);
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/account-header/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await accountService.updateAccountHeader(req)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  // Opening Balance
  fastify.get('/opening-balance',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { data, count} = await accountService.listOpeningBalance(req);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/opening-balance/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      await accountService.updateOpeningBalance(req)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}