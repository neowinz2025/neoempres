import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12)

  await prisma.user.upsert({
    where: { email: 'admin@loanpro.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@loanpro.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  // Create default configs
  const configs = [
    { key: 'MULTA_PERCENT', value: '2.0' },
    { key: 'JUROS_DIARIO', value: '0.033' },
    { key: 'FASTDEPIX_WEBHOOK_SECRET', value: '' },
    { key: 'ZAPI_INSTANCE_ID', value: '' },
    { key: 'ZAPI_TOKEN', value: '' },
    { key: 'TELEGRAM_BOT_TOKEN', value: '' },
  ]

  for (const config of configs) {
    await prisma.config.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    })
  }

  // Create sample client
  const cliente = await prisma.cliente.upsert({
    where: { token: 'demo-client-token' },
    update: {},
    create: {
      nome: 'João da Silva',
      telefone: '11999999999',
      score: 'B',
      token: 'demo-client-token',
    },
  })

  console.log(`✅ Admin user created: admin@loanpro.com / admin123`)
  console.log(`✅ Sample client created: ${cliente.nome} (token: ${cliente.token})`)
  console.log(`✅ Default configs created`)
  console.log('🎉 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
