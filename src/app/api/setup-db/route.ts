import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// POST: Create webauthn_credentials table if it doesn't exist
export async function POST() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Create the table using raw SQL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "webauthn_credentials" (
        "id" TEXT NOT NULL,
        "credentialId" TEXT NOT NULL,
        "publicKey" TEXT NOT NULL,
        "counter" INTEGER NOT NULL DEFAULT 0,
        "transports" TEXT,
        "userId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "webauthn_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `)

    // Create unique index on credentialId
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId")
    `)

    return NextResponse.json({ success: true, message: 'Tabela webauthn_credentials criada com sucesso' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[DB Setup] Error:', msg)
    // If table already exists, that's fine
    if (msg.includes('already exists')) {
      return NextResponse.json({ success: true, message: 'Tabela já existe' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
