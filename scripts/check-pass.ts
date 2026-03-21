import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany()
  console.log('USERS:')
  for (const u of users) {
    console.log(`ID: ${u.id} | Email: ${u.email} | Role: ${u.role} | Active: ${u.active}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
