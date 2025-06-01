const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const journalService = require('../service/journal.service');
const contactService = require('../service/contact.service');

module.exports = async function(fastify, opts) {
  fastify.get('/',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { data, count} = await journalService.list(req);
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
      const { id } = req.params;
      const row = await journalService.getJournalDetail(req)
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
      await journalService.createJournal(req);
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
      await journalService.updateJournal(req)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}