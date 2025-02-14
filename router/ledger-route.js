const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const ledgerService = require('../service/ledger.service');

module.exports = async function(fastify, opts) {
  fastify.get('/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async (req, reply) => {
    try {
      const { data, count} = await ledgerService.getLedger(req);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}