import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: 'hugo200',
        mode: 'insensitive'
      }
    }
  })

  if (!user) {
    console.log('User hugo200 not found!')
    return
  }

  console.log(`Found: ${user.email}, Active: ${user.active}`)
  const valid = await bcrypt.compare('Hugo@9615', user.password)
  console.log(`Password match for Hugo@9615: ${valid}`)

  const valid2 = await bcrypt.compare('123456', user.password)
  console.log(`Password match for 123456: ${valid2}`)
}

main()
