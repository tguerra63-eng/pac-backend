// src/server.js
require('dotenv').config()
const Fastify = require('fastify')
const cors    = require('@fastify/cors')
const jwt     = require('@fastify/jwt')

const app = Fastify({ logger: true })

// ─── PLUGINS ──────────────────────────────────────────────────────────
app.register(cors, {
  origin: true, // em produção coloque o domínio exato
  credentials: true
})

app.register(jwt, {
  secret: process.env.JWT_SECRET
})

// ─── DECORATOR: verifica token JWT ────────────────────────────────────
app.decorate('authenticate', async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch (err) {
    reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
})

// ─── DECORATOR: somente ADMIN ─────────────────────────────────────────
app.decorate('adminOnly', async (req, reply) => {
  await req.jwtVerify()
  if (req.user.role !== 'ADMIN') {
    reply.status(403).send({ error: 'Acesso negado' })
  }
})

// ─── ROTAS ────────────────────────────────────────────────────────────
app.register(require('./routes/auth'),          { prefix: '/api/auth' })
app.register(require('./routes/users'),         { prefix: '/api/users' })
app.register(require('./routes/products'),      { prefix: '/api/products' })
app.register(require('./routes/demands'),       { prefix: '/api/demands' })
app.register(require('./routes/orders'),        { prefix: '/api/orders' })
app.register(require('./routes/reviews'),       { prefix: '/api/reviews' })
app.register(require('./routes/messages'),      { prefix: '/api/messages' })
app.register(require('./routes/notifications'), { prefix: '/api/notifications' })
app.register(require('./routes/financial'),     { prefix: '/api/financial' })
app.register(require('./routes/admin'),         { prefix: '/api/admin' })
app.register(require('./routes/whatsapp'),      { prefix: '/api/whatsapp' })

// ─── HEALTH CHECK ─────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date() }))

// ─── START ────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await app.listen({ port: process.env.PORT || 3333, host: '0.0.0.0' })
    console.log(`✅ Servidor rodando na porta ${process.env.PORT || 3333}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}
start()
