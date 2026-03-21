import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ['hugo200', 'Hugo200'] }
    },
    orderBy: { createdAt: 'asc' }
  })

  if (users.length < 2) {
    console.log('No duplicates found. Exiting.')
    return
  }

  const primary = users[0] // The older one (hugo200)
  const secondary = users[1] // The newer one (Hugo200)

  console.log(`Primary User: ${primary.email} (${primary.id})`)
  console.log(`Secondary User: ${secondary.email} (${secondary.id})`)

  // Move all logs from secondary to primary
  const updateLogs = await prisma.log.updateMany({
    where: { userId: secondary.id },
    data: { userId: primary.id }
  })

  console.log(`Moved ${updateLogs.count} logs to primary user.`)

  // Delete secondary user
  await prisma.user.delete({
    where: { id: secondary.id }
  })

  console.log('Secondary user deleted successfully. We now have exactly ONE admin account.')

  // Hardcode a fallback password so they can definitely log back in
  const bcrypt = require('bcryptjs')
  const newHash = await bcrypt.hash('Hugo@9615', 12)
  await prisma.user.update({
    where: { id: primary.id },
    data: { password: newHash }
  })

  console.log('Reset canonical admin password to "Hugo@9615" to ensure access.')

}

main().catch(console.error).finally(() => prisma.$disconnect())
