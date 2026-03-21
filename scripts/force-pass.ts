import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const newHash = await bcrypt.hash('123456', 12)
  
  const user = await prisma.user.findFirst({
    where: { email: 'hugo200' }
  })

  if (!user) {
    console.log('User not found')
    return
  }
  
  await prisma.user.update({
    where: { id: user.id },
    data: { password: newHash }
  })
  
  console.log('Password for hugo200 reset to: 123456')
}

main().catch(console.error).finally(() => prisma.$disconnect())
