import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('123456', 10)
  
  await prisma.user.updateMany({
    where: { email: 'hugo200' },
    data: { password: hash }
  })
  
  await prisma.user.upsert({
    where: { email: 'Hugo200' },
    update: { password: hash, role: 'ADMIN', name: 'Hugo' },
    create: { email: 'Hugo200', password: hash, role: 'ADMIN', name: 'Hugo' }
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
