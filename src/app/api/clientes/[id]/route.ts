import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      emprestimos: {
        include: {
          parcelas: { orderBy: { numero: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!cliente) {
    return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ data: cliente })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { nome, telefone, score, notificarWpp } = body

  try {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(telefone && { telefone }),
        ...(score && { score }),
        ...(notificarWpp !== undefined && { notificarWpp: Boolean(notificarWpp) }),
      },
    })

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'ATUALIZAR_CLIENTE',
        detalhes: `Cliente ${cliente.nome} atualizado`,
      },
    })

    return NextResponse.json({ data: cliente })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.cliente.delete({ where: { id } })

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'DELETAR_CLIENTE',
        detalhes: `Cliente ID ${id} deletado`,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao deletar cliente' }, { status: 500 })
  }
}
