import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where = search
    ? {
        OR: [
          { nome: { contains: search, mode: 'insensitive' as const } },
          { telefone: { contains: search } },
        ],
      }
    : {}

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      include: {
        emprestimos: {
          select: { id: true, saldoDevedor: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cliente.count({ where }),
  ])

  return NextResponse.json({
    data: clientes,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { nome, telefone, notificarWpp = true } = body

    if (!nome || !telefone) {
      return NextResponse.json(
        { error: 'Nome e telefone são obrigatórios' },
        { status: 400 }
      )
    }

    // Sanitize inputs
    const sanitizedNome = nome.trim().replace(/<[^>]*>/g, '').substring(0, 200)
    const sanitizedTelefone = telefone.trim().replace(/[^0-9+()-\s]/g, '').substring(0, 20)

    if (!sanitizedNome || !sanitizedTelefone) {
      return NextResponse.json(
        { error: 'Nome ou telefone inválido' },
        { status: 400 }
      )
    }

    const cliente = await prisma.cliente.create({
      data: { nome: sanitizedNome, telefone: sanitizedTelefone, notificarWpp: Boolean(notificarWpp) },
    })

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'CRIAR_CLIENTE',
        detalhes: `Cliente ${nome} criado`,
      },
    })

    return NextResponse.json({ data: cliente }, { status: 201 })
  } catch (error) {
    console.error('Error creating client:', error)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
