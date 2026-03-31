// src/prisma/seed.js
// Roda com: node src/prisma/seed.js
// Cria o usuário admin master e alguns dados de exemplo

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // ── ADMIN MASTER ────────────────────────────────────────────────────
  // ATENÇÃO: Após rodar o seed, apague a variável ADMIN_PASSWORD_PLAIN do .env
  const adminEmail    = process.env.ADMIN_EMAIL    || 'talles_guerra@hotmail.com'
  const adminPassword = process.env.ADMIN_PASSWORD_PLAIN

  if (!adminPassword) {
    console.error('❌ Defina ADMIN_PASSWORD_PLAIN no .env antes de rodar o seed')
    process.exit(1)
  }

  // Hash seguro com bcrypt (custo 12)
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: 'ADMIN', isActive: true, whatsappVerified: true },
    create: {
      name:            'Talles Guerra',
      email:           adminEmail,
      passwordHash,
      role:            'ADMIN',
      document:        '000.000.000-00',
      city:            'Fortaleza',
      state:           'CE',
      phone:           '85999999999',
      whatsappVerified: true,
      kycStatus:       'APPROVED',
      isActive:        true,
    }
  })

  console.log(`✅ Admin criado: ${admin.email}`)
  console.log('⚠️  IMPORTANTE: Apague ADMIN_PASSWORD_PLAIN do seu .env agora!')

  // ── USUÁRIOS DE EXEMPLO ─────────────────────────────────────────────
  const senhaDemo = await bcrypt.hash('demo12345', 12)

  const produtor = await prisma.user.upsert({
    where: { email: 'joao@queijaria.com' },
    update: {},
    create: {
      name: 'João Mendes', email: 'joao@queijaria.com',
      passwordHash: senhaDemo, role: 'PRODUTOR',
      document: '12.345.678/0001-90', city: 'Caxambu', state: 'MG',
      phone: '35999990001', whatsappVerified: true,
      kycStatus: 'APPROVED', isActive: true,
    }
  })

  const comprador = await prisma.user.upsert({
    where: { email: 'maria@pizzaria.com' },
    update: {},
    create: {
      name: 'Maria Silva', email: 'maria@pizzaria.com',
      passwordHash: senhaDemo, role: 'COMPRADOR',
      document: '98.765.432/0001-10', city: 'São Paulo', state: 'SP',
      phone: '11999990002', whatsappVerified: true,
      kycStatus: 'APPROVED', isActive: true,
    }
  })

  console.log(`✅ Usuários demo criados (senha: demo12345)`)

  // ── PRODUTO DE EXEMPLO ──────────────────────────────────────────────
  await prisma.product.upsert({
    where: { id: 'seed-produto-1' },
    update: {},
    create: {
      id:             'seed-produto-1',
      produtorId:     produtor.id,
      cheeseType:     'Minas Padrão',
      format:         'BARRA_2KG',
      pricePerKg:     18.90,
      availableKg:    320,
      vacuumPacked:   true,
      labelType:      'COMPLETO_SIE',
      sliceable:      true,
      deliveryType:   'AMBOS',
      paymentMethods: ['PIX', 'BOLETO'],
      description:    'Minas Padrão artesanal, maturado 15 dias, produção própria.',
      isActive:       true,
    }
  })

  console.log('✅ Produto demo criado')
  console.log('\n🎉 Seed concluído com sucesso!')
  console.log('\n📋 Resumo:')
  console.log(`   Admin:    ${adminEmail}`)
  console.log(`   Produtor: joao@queijaria.com / demo12345`)
  console.log(`   Comprador: maria@pizzaria.com / demo12345`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
