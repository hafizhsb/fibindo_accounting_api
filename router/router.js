const Joi = require('joi')
const { successRes, errorRes } = require('../plugins/reply');
const userService = require('../service/user.service');
const accountService = require('../service/account.service');

module.exports = async function(fastify, opts) {
  fastify.get(
    '/',
    async function(request, reply) {
      return request.user
  });

  fastify.get(
    '/account',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      return request.user
  });
  
  fastify.post('/login', async (req, reply) => {
    // some code
    const { body } = req;
    try {
      const token = fastify.jwt.sign({
        email: body.email,
        role: 'member'
      })
      const data = await userService.login(body, token)
      reply.send(successRes(data))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.post('/register', async (req, reply) => {
    // some code
    const { body } = req;
    console.log(body)
    try {
      await userService.createUser(body)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get(
    '/profile',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        const data = await userService.profile(request);
        reply.send(successRes(data))
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.put(
    '/profile',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        await userService.updateProfile(request);
        reply.send(successRes())
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.post(
    '/change-password',
    {
      onRequest: [fastify.authenticate],
      schema: {
        body: Joi.object().keys({
          password: Joi.string().required().min(6),
          new_password: Joi.string().required().min(6)
        }).required()
      },
      // schemaCompiler: schema => data => Joi.validate(data, schema)
      validatorCompiler: ({ schema, method, url, httpPart }) => {
        return data => schema.validate(data)
      }
    },
    async function(request, reply) {
      try {
        await userService.changePassword(request);
        reply.send(successRes())
      } catch (err) {
        console.log('err', err);
        throw err;
      }
    }
  );

  fastify.get('/vessel', async (req, reply) => {
    try {
      const rows = await productService.getVessels()
      reply.send(successRes(rows))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get(
    '/activate/:token',
    async function(request, reply) {
      console.log(request.params);
      try {
        await userService.activate(request.params.token);
        reply.send(successRes())
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.post('/forgot-password', async (req, reply) => {
    // some code
    const { body } = req;
    try {
      await userService.forgotPassword(body)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.post('/reset-password', async (req, reply) => {
    // some code
    const { body } = req;
    try {
      await userService.resetPassword(body)
      reply.send(successRes())
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get('/products', async (req, reply) => {
    try {
      const data = await productService.list()
      reply.send(successRes(data))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  fastify.get('/product/:id', async (req, reply) => {
    try {
      const { slug } = req.params;
      console.log('sluggg', slug);
      const row = await productService.getProductBySlug(slug)
      reply.send(successRes(row))
    } catch (err) {
      console.log('err', err);
      throw err;
    }
  })

  // location
  fastify.get(
    '/country',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        const rows = await locationService.country(request);
        reply.send(successRes(rows[0], rows[1][0].count))
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.get(
    '/province',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        const rows = await locationService.province(request);
        reply.send(successRes(rows[0], rows[1][0].count))
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.get(
    '/city/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        const rows = await locationService.city(request);
        reply.send(successRes(rows[0], rows[1][0].count))
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.get(
    '/suburb/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        const rows = await locationService.suburb(request);
        reply.send(successRes(rows[0], rows[1][0].count))
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });

  fastify.get(
    '/area/:id',
    {
      onRequest: [fastify.authenticate]
    },
    async function(request, reply) {
      try {
        const rows = await locationService.area(request);
        reply.send(successRes(rows[0], rows[1][0].count))
      } catch (err) {
        console.log('err', err);
        throw err;
      }
  });
}