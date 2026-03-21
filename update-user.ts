import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('Hugo@9615', 10)
  
  // Upsert hugo200
  await prisma.user.upsert({
    where: { email: 'hugo200' },
    update: { password: hash, role: 'ADMIN', name: 'Hugo' },
    create: { email: 'hugo200', password: hash, role: 'ADMIN', name: 'Hugo' }
  })
  
  // Delete old admin
  const admins = await prisma.user.findMany({ where: { email: 'admin@loanpro.com' } })
  if (admins.length > 0) {
    await prisma.user.deleteMany({ where: { email: 'admin@loanpro.com' } })
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
