// src/routes/orders.js
const { PrismaClient } = require('@prisma/client')
const { sendWhatsApp, notificacoes } = require('../services/whatsapp')

const prisma = new PrismaClient()

module.exports = async function (app) {

  app.addHook('preHandler', app.authenticate)

  // ── CRIAR PEDIDO (comprador) ──────────────────────────────────────
  app.post('/', async (req, reply) => {
    if (req.user.role !== 'COMPRADOR') return reply.status(403).send({ error: 'Apenas compradores podem criar pedidos' })

    const { productId, quantityKg, paymentMethod, notes } = req.body

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { produtor: true }
    })
    if (!product) return reply.status(404).send({ error: 'Produto não encontrado' })
    if (!product.isActive) return reply.status(400).send({ error: 'Produto indisponível' })

    const totalAmount = Number(product.pricePerKg) * Number(quantityKg)

    const order = await prisma.order.create({
      data: {
        compradorId:   req.user.id,
        produtorId:    product.produtorId,
        productId,
        quantityKg,
        unitPrice:     product.pricePerKg,
        totalAmount,
        paymentMethod,
        notes,
        status:        'PENDENTE',
      },
      include: {
        comprador: true,
        produtor:  true,
        product:   true,
      }
    })

    // Cria transação financeira vinculada ao pedido
    const fee = totalAmount * 0.035
    await prisma.transaction.create({
      data: {
        orderId:            order.id,
        grossAmount:        totalAmount,
        platformFeeAmount:  fee,
        produtorAmount:     totalAmount - fee,
        paymentMethod,
        status:             'PENDING',
      }
    })

    // Notifica produtor via WhatsApp
    await sendWhatsApp(
      order.produtor.phone,
      notificacoes.novoPedido(
        order.produtor.name,
        order.comprador.name,
        product.cheeseType,
        totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      )
    )

    // Notificação no banco
    await prisma.notification.create({
      data: {
        userId: order.produtorId,
        type:   'NEW_ORDER',
        title:  'Novo Pedido!',
        body:   `${order.comprador.name} fez um pedido de ${product.cheeseType} — R$ ${totalAmount.toFixed(2)}`,
        data:   { orderId: order.id },
        sentViaWA: true,
      }
    })

    return reply.status(201).send(order)
  })

  // ── LISTAR MEUS PEDIDOS ───────────────────────────────────────────
  app.get('/', async (req, reply) => {
    const { status } = req.query
    const isProdutor = req.user.role === 'PRODUTOR'

    const where = {
      ...(isProdutor ? { produtorId: req.user.id } : { compradorId: req.user.id }),
      ...(status && { status })
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        comprador: { select: { id: true, name: true, city: true, fachadaUrl: true } },
        produtor:  { select: { id: true, name: true, city: true } },
        product:   { include: { photos: true } },
        transaction: true,
        _count: { select: { messages: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    return reply.send(orders)
  })

  // ── VER PEDIDO ESPECÍFICO ─────────────────────────────────────────
  app.get('/:id', async (req, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        comprador: true,
        produtor:  true,
        product:   { include: { photos: true } },
        transaction: true,
        messages: {
          include: { sender: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'asc' }
        },
        reviews: { include: { reviewer: { select: { name: true, role: true } } } }
      }
    })

    if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' })

    // Garante que só quem está no pedido pode ver (ou admin)
    const autorizado = req.user.role === 'ADMIN'
      || order.compradorId === req.user.id
      || order.produtorId  === req.user.id
    if (!autorizado) return reply.status(403).send({ error: 'Acesso negado' })

    return reply.send(order)
  })

  // ── ACEITAR PEDIDO (produtor) ─────────────────────────────────────
  app.post('/:id/accept', async (req, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { comprador: true, produtor: true, product: true }
    })
    if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' })
    if (order.produtorId !== req.user.id) return reply.status(403).send({ error: 'Acesso negado' })
    if (order.status !== 'PENDENTE') return reply.status(400).send({ error: 'Pedido não pode ser aceito' })

    await prisma.order.update({ where: { id: order.id }, data: { status: 'ACEITO' } })

    // Notifica comprador
    await sendWhatsApp(
      order.comprador.phone,
      notificacoes.pedidoAceito(order.comprador.name, order.produtor.name, order.product.cheeseType)
    )

    return reply.send({ message: 'Pedido aceito! Comprador notificado.' })
  })

  // ── RECUSAR PEDIDO (produtor) ─────────────────────────────────────
  app.post('/:id/refuse', async (req, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { comprador: true, product: true }
    })
    if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' })
    if (order.produtorId !== req.user.id) return reply.status(403).send({ error: 'Acesso negado' })

    await prisma.order.update({ where: { id: order.id }, data: { status: 'RECUSADO' } })

    await sendWhatsApp(
      order.comprador.phone,
      notificacoes.pedidoRecusado(order.comprador.name, order.product.cheeseType)
    )

    return reply.send({ message: 'Pedido recusado.' })
  })

  // ── MARCAR COMO ENTREGUE ──────────────────────────────────────────
  app.post('/:id/deliver', async (req, reply) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { produtor: true, transaction: true }
    })
    if (!order) return reply.status(404).send({ error: 'Pedido não encontrado' })
    if (order.produtorId !== req.user.id) return reply.status(403).send({ error: 'Acesso negado' })

    await prisma.order.update({ where: { id: order.id }, data: { status: 'ENTREGUE' } })

    // Atualiza transação para pago
    if (order.transaction) {
      await prisma.transaction.update({
        where: { id: order.transaction.id },
        data: { status: 'PAID', paidAt: new Date() }
      })
    }

    // Notifica produtor sobre repasse
    await sendWhatsApp(
      order.produtor.phone,
      notificacoes.pagamentoConfirmado(
        order.produtor.name,
        Number(order.totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      )
    )

    return reply.send({ message: 'Pedido marcado como entregue. Pagamento confirmado!' })
  })
}
