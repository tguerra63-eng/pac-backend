// src/routes/auth.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const { z } = require('zod')
const { sendWhatsApp } = require('../services/whatsapp')

const prisma = new PrismaClient()

// Gera código de 6 dígitos
function gerarCodigo() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

module.exports = async function (app) {

  // ── CADASTRO ──────────────────────────────────────────────────────
  app.post('/register', async (req, reply) => {
    const schema = z.object({
      name:     z.string().min(3),
      email:    z.string().email(),
      password: z.string().min(8),
      role:     z.enum(['PRODUTOR', 'COMPRADOR']),
      document: z.string().min(11),
      city:     z.string().min(2),
      state:    z.string().length(2),
      phone:    z.string().min(10), // WhatsApp
    })

    const data = schema.parse(req.body)

    // Verifica se e-mail já existe
    const exists = await prisma.user.findUnique({ where: { email: data.email } })
    if (exists) return reply.status(400).send({ error: 'E-mail já cadastrado' })

    // Hash da senha
    const passwordHash = await bcrypt.hash(data.password, 12)

    // Gera código WhatsApp
    const whatsappCode = gerarCodigo()

    // Cria usuário (inativo até verificar WhatsApp)
    const user = await prisma.user.create({
      data: {
        name:         data.name,
        email:        data.email,
        passwordHash,
        role:         data.role,
        document:     data.document,
        city:         data.city,
        state:        data.state,
        phone:        data.phone,
        whatsappCode,
        isActive:     false,
      }
    })

    // Envia código via WhatsApp
    await sendWhatsApp(
      data.phone,
      `🧀 *Produtor ao Comprador*\n\nSeu código de verificação é: *${whatsappCode}*\n\nVálido por 15 minutos.`
    )

    return reply.status(201).send({
      message: 'Cadastro criado! Verifique seu WhatsApp para ativar a conta.',
      userId: user.id
    })
  })

  // ── VERIFICAR WHATSAPP ────────────────────────────────────────────
  app.post('/verify-whatsapp', async (req, reply) => {
    const { userId, code } = req.body

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })
    if (user.whatsappVerified) return reply.send({ message: 'WhatsApp já verificado' })
    if (user.whatsappCode !== code) return reply.status(400).send({ error: 'Código inválido' })

    await prisma.user.update({
      where: { id: userId },
      data: {
        whatsappVerified: true,
        isActive:         true,
        whatsappCode:     null,
      }
    })

    // Gera token JWT já na verificação
    const token = app.jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    return reply.send({
      message: 'WhatsApp verificado! Conta ativa. ✅',
      token,
      user: { id: user.id, name: user.name, role: user.role }
    })
  })

  // ── LOGIN ─────────────────────────────────────────────────────────
  app.post('/login', async (req, reply) => {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.status(401).send({ error: 'E-mail ou senha incorretos' })

    // Verifica se conta está ativa (WhatsApp verificado)
    if (!user.isActive) {
      return reply.status(403).send({
        error: 'Conta não ativada. Verifique seu WhatsApp.',
        userId: user.id
      })
    }

    const senhaCorreta = await bcrypt.compare(password, user.passwordHash)
    if (!senhaCorreta) return reply.status(401).send({ error: 'E-mail ou senha incorretos' })

    const token = app.jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      { expiresIn: process.env.JWT_EXPIRES_IN }
    )

    return reply.send({
      token,
      user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        city:  user.city,
        state: user.state,
      }
    })
  })

  // ── REENVIAR CÓDIGO WHATSAPP ──────────────────────────────────────
  app.post('/resend-code', async (req, reply) => {
    const { userId } = req.body
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ error: 'Usuário não encontrado' })

    const novoCode = gerarCodigo()
    await prisma.user.update({ where: { id: userId }, data: { whatsappCode: novoCode } })

    await sendWhatsApp(
      user.phone,
      `🧀 *Produtor ao Comprador*\n\nNovo código de verificação: *${novoCode}*`
    )

    return reply.send({ message: 'Novo código enviado via WhatsApp!' })
  })

  // ── ME (dados do usuário logado) ──────────────────────────────────
  app.get('/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true,
        city: true, state: true, phone: true,
        kycStatus: true, isActive: true, avatarUrl: true, fachadaUrl: true,
        createdAt: true,
      }
    })
    return reply.send(user)
  })
}
