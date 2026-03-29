import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ativoStr = searchParams.get('ativo')
  const q = searchParams.get('q')

  const where: any = {}
  if (ativoStr) where.ativo = ativoStr === 'true'
  if (q) where.nome = { contains: q, mode: 'insensitive' }

  try {
    const produtos = await prisma.produto.findMany({
      where,
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({ data: produtos })
  } catch (error) {
    console.error('Error fetching produtos:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { nome, descricao, valorBase } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome do produto é obrigatório' }, { status: 400 })
    }

    const produto = await prisma.produto.create({
      data: {
        nome,
        descricao: descricao || null,
        valorBase: typeof valorBase === 'number' ? valorBase : null,
        ativo: true,
      },
    })

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'CRIAR_PRODUTO',
        detalhes: `Produto ${produto.nome} criado`,
      },
    })

    return NextResponse.json({ data: produto }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
