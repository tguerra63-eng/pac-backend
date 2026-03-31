// src/routes/admin.js
// PAINEL ADMIN — acesso total à plataforma
// Só usuários com role = ADMIN podem acessar

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

module.exports = async function (app) {

  // Todas as rotas admin exigem token JWT + role ADMIN
  app.addHook('preHandler', app.adminOnly)

  // ── DASHBOARD ADMIN ───────────────────────────────────────────────
  app.get('/dashboard', async (req, reply) => {
    const [
      totalUsers, totalProducts, totalOrders,
      totalTransacted, pendingKyc, activeUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.transaction.aggregate({ _sum: { grossAmount: true }, where: { status: 'PAID' } }),
      prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      prisma.user.count({ where: { isActive: true } }),
    ])

    const comissaoTotal = await prisma.transaction.aggregate({
      _sum: { platformFeeAmount: true },
      where: { status: 'PAID' }
    })

    return reply.send({
      totalUsers,
      totalProducts,
      totalOrders,
      totalTransacted: totalTransacted._sum.grossAmount || 0,
      comissaoTotal:   comissaoTotal._sum.platformFeeAmount || 0,
      pendingKyc,
      activeUsers,
    })
  })

  // ── LISTAR TODOS OS USUÁRIOS ──────────────────────────────────────
  app.get('/users', async (req, reply) => {
    const { page = 1, limit = 20, role, search, kycStatus } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (role)      where.role      = role
    if (kycStatus) where.kycStatus = kycStatus
    if (search)    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: Number(skip), take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, email: true, role: true,
          document: true, city: true, state: true, phone: true,
          kycStatus: true, isActive: true, whatsappVerified: true,
          createdAt: true,
          _count: { select: { ordersAsBuyer: true, ordersAsSeller: true } }
        }
      }),
      prisma.user.count({ where })
    ])

    return reply.send({ users, total, pages: Math.ceil(total / limit) })
  })

  // ── VER USUÁRIO ESPECÍFICO ────────────────────────────────────────
  app.get('/users/:id', async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        products:       { include: { photos: true } },
        ordersAsBuyer:  { include: { product: true, produtor: true } },
        ordersAsSeller: { include: { product: true, comprador: true } },
        reviewsReceived: { include: { reviewer: true } },
        demands:        true,
      }
    })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })
    return reply.send(user)
  })

  // ── EDITAR USUÁRIO ────────────────────────────────────────────────
  app.put('/users/:id', async (req, reply) => {
    const { name, email, role, city, state, phone, kycStatus, isActive } = req.body

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(name      && { name }),
        ...(email     && { email }),
        ...(role      && { role }),
        ...(city      && { city }),
        ...(state     && { state }),
        ...(phone     && { phone }),
        ...(kycStatus && { kycStatus }),
        ...(isActive !== undefined && { isActive }),
      }
    })

    return reply.send({ message: 'Usuário atualizado', user })
  })

  // ── VALIDAR KYC ───────────────────────────────────────────────────
  app.post('/users/:id/validate-kyc', async (req, reply) => {
    const { approved } = req.body

    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        kycStatus: approved ? 'APPROVED' : 'REJECTED',
        isActive:  approved ? true : false,
      }
    })

    return reply.send({ message: approved ? 'Usuário validado ✅' : 'Usuário rejeitado ❌' })
  })

  // ── TODOS OS PRODUTOS ─────────────────────────────────────────────
  app.get('/products', async (req, reply) => {
    const products = await prisma.product.findMany({
      include: {
        produtor: { select: { id: true, name: true, city: true } },
        photos: true,
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send(products)
  })

  // ── EDITAR PRODUTO ────────────────────────────────────────────────
  app.put('/products/:id', async (req, reply) => {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body
    })
    return reply.send({ message: 'Produto atualizado', product })
  })

  // ── REMOVER PRODUTO ───────────────────────────────────────────────
  app.delete('/products/:id', async (req, reply) => {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false }
    })
    return reply.send({ message: 'Produto desativado' })
  })

  // ── TODOS OS PEDIDOS ──────────────────────────────────────────────
  app.get('/orders', async (req, reply) => {
    const { status, page = 1, limit = 20 } = req.query
    const skip = (page - 1) * limit
    const where = status ? { status } : {}

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, skip: Number(skip), take: Number(limit),
        include: {
          comprador: { select: { id: true, name: true, city: true } },
          produtor:  { select: { id: true, name: true, city: true } },
          product:   { select: { cheeseType: true, format: true } },
          transaction: true,
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count({ where })
    ])

    return reply.send({ orders, total, pages: Math.ceil(total / limit) })
  })

  // ── EDITAR PEDIDO ─────────────────────────────────────────────────
  app.put('/orders/:id', async (req, reply) => {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: req.body
    })
    return reply.send({ message: 'Pedido atualizado', order })
  })

  // ── VER TODAS AS MENSAGENS DE UM PEDIDO ───────────────────────────
  app.get('/orders/:id/messages', async (req, reply) => {
    const messages = await prisma.message.findMany({
      where: { orderId: req.params.id },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' }
    })
    return reply.send(messages)
  })

  // ── FINANCEIRO GERAL ──────────────────────────────────────────────
  app.get('/financial', async (req, reply) => {
    const transactions = await prisma.transaction.findMany({
      include: {
        order: {
          include: {
            comprador: { select: { name: true } },
            produtor:  { select: { name: true } },
            product:   { select: { cheeseType: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const resumo = await prisma.transaction.groupBy({
      by: ['status'],
      _sum: { grossAmount: true, platformFeeAmount: true, produtorAmount: true },
      _count: true,
    })

    return reply.send({ transactions, resumo })
  })

  // ── TODAS AS AVALIAÇÕES ───────────────────────────────────────────
  app.get('/reviews', async (req, reply) => {
    const reviews = await prisma.review.findMany({
      include: {
        reviewer: { select: { name: true, role: true } },
        reviewed: { select: { name: true, role: true } },
        order:    { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send(reviews)
  })

  // ── CRIAR PRODUTO (admin pode criar para qualquer produtor) ───────
  app.post('/products', async (req, reply) => {
    const product = await prisma.product.create({ data: req.body })
    return reply.status(201).send({ message: 'Produto criado', product })
  })

  // ── NOTIFICAÇÃO MANUAL (admin envia para usuário) ─────────────────
  app.post('/notify', async (req, reply) => {
    const { userId, title, body, sendWhatsapp } = req.body
    const { sendWhatsApp: wa, notificacoes } = require('../services/whatsapp')

    const notif = await prisma.notification.create({
      data: { userId, type: 'ADMIN_MESSAGE', title, body }
    })

    if (sendWhatsapp) {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user) await wa(user.phone, `📢 *${title}*\n\n${body}`)
    }

    return reply.send({ message: 'Notificação enviada', notif })
  })
}
