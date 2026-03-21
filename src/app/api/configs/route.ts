import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const configsList = await prisma.config.findMany()
    const configs: Record<string, string> = {}
    configsList.forEach(c => { configs[c.key] = c.value })
    return NextResponse.json({ data: configs })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar configurações' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const configData = body.configs || body
    const updates = []
    
    for (const [key, value] of Object.entries(configData)) {
      if (typeof value === 'string') {
        updates.push(
          prisma.config.upsert({
            where: { key },
            update: { value },
            create: { key, value }
          })
        )
      }
    }
    await prisma.$transaction(updates)
    
    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'ATUALIZAR_CONFIGS',
        detalhes: 'Configurações do sistema atualizadas',
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 })
  }
}
