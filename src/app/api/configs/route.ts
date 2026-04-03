import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const sensitivePatterns = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD']
    const configsList = await prisma.config.findMany()
    const configs: Record<string, string> = {}
    configsList.forEach(c => {
      const isSensitive = sensitivePatterns.some(p => c.key.toUpperCase().includes(p))
      if (isSensitive && c.value.length > 4) {
        configs[c.key] = '••••••••' + c.value.slice(-4)
      } else {
        configs[c.key] = c.value
      }
    })
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
        // Validate key format
        if (!/^[A-Za-z0-9_]+$/.test(key)) continue

        // Skip masked/placeholder values — user didn't change the field
        // Masks are '•' (U+2022) sent back as-is from the GET response
        const isMasked = value.includes('•') || value.startsWith('••••')
        if (isMasked) continue

        // Skip empty sensitive fields — don't overwrite with empty string
        const isSensitiveField = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD'].some(p => key.toUpperCase().includes(p))
        if (isSensitiveField && value.trim() === '') continue

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
