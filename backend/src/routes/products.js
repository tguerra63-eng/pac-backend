// src/routes/products.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

module.exports = async function (app) {

  // ── LISTAR (público) ──────────────────────────────────────────────
  app.get('/', async (req, reply) => {
    const { type, state, delivery, sie, page = 1, limit = 20 } = req.query
    const skip = (page - 1) * limit

    const where = { isActive: true }
    if (type)     where.cheeseType  = { contains: type, mode: 'insensitive' }
    if (state)    where.produtor    = { state }
    if (delivery) where.deliveryType = delivery
    if (sie === 'true') where.labelType = 'COMPLETO_SIE'

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where, skip: Number(skip), take: Number(limit),
        include: {
          produtor: { select: { id: true, name: true, city: true, state: true, avatarUrl: true } },
          photos:   true,
          _count:   { select: { reviews: true } },
          reviews:  { select: { rating: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where })
    ])

    // Calcula média de avaliações
    const productsComMedia = products.map(p => ({
      ...p,
      avgRating: p.reviews.length
        ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length
        : null,
      reviews: undefined
    }))

    return reply.send({ products: productsComMedia, total, pages: Math.ceil(total / limit) })
  })

  // ── VER PRODUTO ───────────────────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        produtor: { select: { id: true, name: true, city: true, state: true, phone: true, avatarUrl: true } },
        photos:   true,
        reviews: {
          include: { reviewer: { select: { name: true, role: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' })
    return reply.send(product)
  })

  // ── CRIAR PRODUTO (produtor autenticado) ──────────────────────────
  app.post('/', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'PRODUTOR' && req.user.role !== 'ADMIN')
      return reply.status(403).send({ error: 'Apenas produtores podem cadastrar produtos' })

    const product = await prisma.product.create({
      data: {
        ...req.body,
        produtorId: req.user.role === 'ADMIN' ? req.body.produtorId : req.user.id
      }
    })
    return reply.status(201).send(product)
  })

  // ── EDITAR PRODUTO (dono ou admin) ────────────────────────────────
  app.put('/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } })
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' })

    const autorizado = req.user.role === 'ADMIN' || product.produtorId === req.user.id
    if (!autorizado) return reply.status(403).send({ error: 'Acesso negado' })

    const updated = await prisma.product.update({ where: { id: req.params.id }, data: req.body })
    return reply.send(updated)
  })
}
