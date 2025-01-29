const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const journalService = require('../service/journal.service');
const contactService = require('../service/contact.service');

module.exports = async function(fastify, opts) {
  fastify.get('/', async (req, reply) => {
    try {
      const { page, page_size } = req.query;
      const { data, count} = await journalService.list(page, page_size);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get('/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const row = await accountService.getAccountDetail(id)
      reply.send(successRes(row))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.post('/', async (req, reply) => {
    try {
      const { body } = req;
      await journalService.createJournal(body);
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.put('/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { body } = req;
      console.log('reqqq', id, body);
      await contactService.updateContact(id, body)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}