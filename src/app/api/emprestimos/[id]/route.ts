import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calcSimulacao } from '@/lib/calculations'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  const emprestimo = await prisma.emprestimo.findUnique({
    where: { id },
    include: {
      cliente: true,
      parcelas: { orderBy: { numero: 'asc' } },
    },
  })

  if (!emprestimo) {
    return NextResponse.json({ error: 'Empréstimo não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ data: emprestimo })
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

  // Renegotiation flow
  if (body.renegociar) {
    const { valor, taxaJuros, tipo, numParcelas, dataInicio } = body

    const emprestimo = await prisma.emprestimo.findUnique({
      where: { id },
      include: { parcelas: true },
    })

    if (!emprestimo) {
      return NextResponse.json({ error: 'Empréstimo não encontrado' }, { status: 404 })
    }

    const novoValor = valor || emprestimo.saldoDevedor
    const novaTaxa = taxaJuros || emprestimo.taxaJuros
    const novoTipo = tipo || emprestimo.tipo
    const novasParcelas = numParcelas || emprestimo.numParcelas
    const inicio = dataInicio ? new Date(dataInicio) : new Date()

    const simulacao = calcSimulacao(novoTipo, novoValor, novaTaxa, novasParcelas, inicio)

    // Cancel pending installments
    await prisma.parcela.updateMany({
      where: {
        emprestimoId: id,
        status: { in: ['PENDENTE', 'ATRASADO'] },
      },
      data: { status: 'PENDENTE' },
    })

    // Delete pending installments and create new ones
    await prisma.parcela.deleteMany({
      where: {
        emprestimoId: id,
        status: 'PENDENTE',
      },
    })

    const updated = await prisma.emprestimo.update({
      where: { id },
      data: {
        valor: novoValor,
        taxaJuros: novaTaxa,
        tipo: novoTipo,
        numParcelas: novasParcelas,
        valorParcela: simulacao.valorParcela,
        saldoDevedor: simulacao.totalPago,
        status: 'ATIVO',
        parcelas: {
          create: simulacao.parcelas.map((p) => ({
            numero: p.numero,
            valor: p.valor,
            valorOriginal: p.valor,
            vencimento: p.vencimento,
          })),
        },
      },
      include: {
        parcelas: { orderBy: { numero: 'asc' } },
        cliente: true,
      },
    })

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'RENEGOCIAR_EMPRESTIMO',
        detalhes: `Empréstimo ${id} renegociado`,
      },
    })

    return NextResponse.json({ data: updated })
  }

  // Simple status update
  try {
    const updated = await prisma.emprestimo.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.multaPercent !== undefined && { multaPercent: body.multaPercent }),
        ...(body.jurosDiario !== undefined && { jurosDiario: body.jurosDiario }),
      },
      include: { parcelas: true, cliente: true },
    })

    return NextResponse.json({ data: updated })
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar empréstimo' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  try {
    await prisma.emprestimo.delete({
      where: { id },
    })
    
    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'DELETAR_EMPRESTIMO',
        detalhes: `Empréstimo ${id} excluído com sucesso`,
      },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting loan:', error)
    return NextResponse.json({ error: 'Erro ao deletar empréstimo' }, { status: 500 })
  }
}
