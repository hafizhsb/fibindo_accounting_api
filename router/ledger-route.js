const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const ledgerService = require('../service/ledger.service');

module.exports = async function(fastify, opts) {
  fastify.get('/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const { page, page_size } = req.query;
      const { data, count} = await ledgerService.getLedger(id, page, page_size);
      reply.send(successRes(data, count))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })
}