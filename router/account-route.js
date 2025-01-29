const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const accountService = require('../service/account.service');

module.exports = async function(fastify, opts) {
  fastify.get('/coa', async (req, reply) => {
    try {
      const { page, page_size } = req.query;
      const { data, count} = await accountService.list(page, page_size);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get('/coa/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const row = await accountService.getAccountDetail(id)
      reply.send(successRes(row))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.post('/coa', async (req, reply) => {
    try {
      const { body } = req;
      await accountService.createAccount(body);
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/coa/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { body } = req;
      console.log('reqqq', id, body);
      await accountService.updateAccount(id, body)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  // Opening Balance
  fastify.get('/opening-balance', async (req, reply) => {
    try {
      const { page, page_size } = req.query;
      const { data, count} = await accountService.listOpeningBalance(page, page_size);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/opening-balance/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { body } = req;
      console.log('reqqq', id, body);
      await accountService.updateOpeningBalance(id, body)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}