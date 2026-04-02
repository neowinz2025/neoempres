import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calcSimulacao } from '@/lib/calculations'
import { UpdateEmprestimoSchema, validateParcelasCustomizadas } from '@/lib/validators'

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
      produto: true,
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

  // Validate input
  const rawBody = await request.json()
  const parsed = UpdateEmprestimoSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const body = parsed.data

  // ── Renegotiation — ADMIN only ────────────────────────────────────────────
  if ('renegociar' in body && body.renegociar) {
    // Restrict renegotiation to ADMIN role
    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Renegociação restrita ao administrador' }, { status: 403 })
    }

    const { valor, taxaJuros, tipo, numParcelas, dataInicio, frequencia, parcelasCustomizadas } = body

    const emprestimo = await prisma.emprestimo.findUnique({
      where: { id },
      include: { parcelas: true },
    })

    if (!emprestimo) {
      return NextResponse.json({ error: 'Empréstimo não encontrado' }, { status: 404 })
    }

    const novoValor = valor ?? emprestimo.saldoDevedor
    const novaTaxa = taxaJuros ?? emprestimo.taxaJuros
    const novoTipo = tipo ?? emprestimo.tipo
    const novasParcelas = numParcelas ?? emprestimo.numParcelas
    const inicio = dataInicio ? new Date(dataInicio) : new Date()
    const freq = frequencia ?? emprestimo.frequencia ?? 'MENSAL'

    const simulacao = calcSimulacao(novoTipo, novoValor, novaTaxa, novasParcelas, inicio, freq)

    let finalParcelas = simulacao.parcelas.map((p) => ({
      numero: p.numero,
      valor: p.valor,
      valorOriginal: p.valor,
      vencimento: p.vencimento,
    }))
    let finalSaldoDevedor = simulacao.totalPago
    let finalValorParcela = simulacao.valorParcela

    if (parcelasCustomizadas && parcelasCustomizadas.length > 0) {
      const validationError = validateParcelasCustomizadas(parcelasCustomizadas, novoValor)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
      finalParcelas = parcelasCustomizadas.map((p) => ({
        numero: p.numero,
        valor: p.valor,
        valorOriginal: p.valor,
        vencimento: new Date(p.vencimento),
      }))
      finalSaldoDevedor = finalParcelas.reduce((acc, curr) => acc + curr.valor, 0)
      finalValorParcela = finalParcelas[0].valor
    }

    // Atomic renegotiation
    const updated = await prisma.$transaction(async (tx) => {
      // Delete pending/overdue installments
      await tx.parcela.deleteMany({
        where: {
          emprestimoId: id,
          status: { in: ['PENDENTE', 'ATRASADO'] },
        },
      })

      const emp = await tx.emprestimo.update({
        where: { id },
        data: {
          valor: novoValor,
          taxaJuros: novaTaxa,
          tipo: novoTipo,
          frequencia: freq,
          numParcelas: finalParcelas.length,
          valorParcela: finalValorParcela,
          saldoDevedor: finalSaldoDevedor,
          status: 'RENEGOCIADO',
          parcelas: { create: finalParcelas },
        },
        include: {
          parcelas: { orderBy: { numero: 'asc' } },
          cliente: true,
          produto: true,
        },
      })

      await tx.log.create({
        data: {
          userId: session.userId,
          acao: 'RENEGOCIAR_EMPRESTIMO',
          nivel: 'WARN',
          entidade: 'EMPRESTIMO',
          entidadeId: id,
          detalhes: `Empréstimo ${id} renegociado — Novo valor: R$${novoValor.toFixed(2)}, Nova taxa: ${novaTaxa}%, Parcelas: ${finalParcelas.length}`,
          ip: request.headers.get('x-forwarded-for') ?? undefined,
        },
      })

      return emp
    })

    return NextResponse.json({ data: updated })
  }

  // ── Simple status/config update ───────────────────────────────────────────
  try {
    const updateBody = body as { status?: string; multaPercent?: number; jurosDiario?: number }

    // Restrict status changes to ADMIN
    if (updateBody.status && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Alteração de status restrita ao administrador' }, { status: 403 })
    }

    const updated = await prisma.emprestimo.update({
      where: { id },
      data: {
        ...(updateBody.status && { status: updateBody.status as any }),
        ...(updateBody.multaPercent !== undefined && { multaPercent: updateBody.multaPercent }),
        ...(updateBody.jurosDiario !== undefined && { jurosDiario: updateBody.jurosDiario }),
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
    await prisma.$transaction(async (tx) => {
      await tx.emprestimo.delete({ where: { id } })

      await tx.log.create({
        data: {
          userId: session.userId,
          acao: 'DELETAR_EMPRESTIMO',
          nivel: 'WARN',
          entidade: 'EMPRESTIMO',
          entidadeId: id,
          detalhes: `Empréstimo ${id} excluído`,
          ip: request.headers.get('x-forwarded-for') ?? undefined,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting loan:', error)
    return NextResponse.json({ error: 'Erro ao deletar empréstimo' }, { status: 500 })
  }
}
