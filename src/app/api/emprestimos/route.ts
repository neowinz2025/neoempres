import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calcSimulacao } from '@/lib/calculations'
import { CreateEmprestimoSchema, validateParcelasCustomizadas } from '@/lib/validators'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const clienteId = searchParams.get('clienteId')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (clienteId) where.clienteId = clienteId

  const [emprestimos, total] = await Promise.all([
    prisma.emprestimo.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, score: true } },
        produto: true,
        parcelas: { orderBy: { numero: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.emprestimo.count({ where }),
  ])

  return NextResponse.json({
    data: emprestimos,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const rawBody = await request.json()
    const parsed = CreateEmprestimoSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const {
      clienteId, valor, taxaJuros, tipo, numParcelas, dataInicio,
      multaPercent, jurosDiario, frequencia, produtoId, parcelasCustomizadas,
    } = parsed.data

    // Validate custom installments if provided
    if (parcelasCustomizadas && parcelasCustomizadas.length > 0) {
      const validationError = validateParcelasCustomizadas(parcelasCustomizadas, valor)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } })
    if (!cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
    }

    const inicio = dataInicio ? new Date(dataInicio) : new Date()
    const freqVal = frequencia || 'MENSAL'
    const simulacao = calcSimulacao(tipo, valor, taxaJuros, numParcelas, inicio, freqVal)

    let finalParcelas = simulacao.parcelas.map((p) => ({
      numero: p.numero,
      valor: p.valor,
      valorOriginal: p.valor,
      vencimento: p.vencimento,
    }))
    let finalSaldoDevedor = simulacao.totalPago
    let finalValorParcela = simulacao.valorParcela

    if (parcelasCustomizadas && parcelasCustomizadas.length > 0) {
      finalParcelas = parcelasCustomizadas.map((p) => ({
        numero: p.numero,
        valor: p.valor,
        valorOriginal: p.valor,
        vencimento: new Date(p.vencimento),
      }))
      finalSaldoDevedor = finalParcelas.reduce((acc, curr) => acc + curr.valor, 0)
      finalValorParcela = finalParcelas[0].valor
    }

    // Use $transaction for atomicity
    const emprestimo = await prisma.$transaction(async (tx) => {
      const emp = await tx.emprestimo.create({
        data: {
          clienteId,
          produtoId: produtoId || null,
          valor,
          taxaJuros,
          tipo,
          frequencia: freqVal,
          numParcelas: finalParcelas.length,
          valorParcela: finalValorParcela,
          saldoDevedor: finalSaldoDevedor,
          multaPercent: multaPercent ?? 2.0,
          jurosDiario: jurosDiario ?? 0.033,
          parcelas: {
            create: finalParcelas,
          },
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
          acao: 'CRIAR_EMPRESTIMO',
          nivel: 'INFO',
          entidade: 'EMPRESTIMO',
          entidadeId: emp.id,
          detalhes: `Empréstimo de R$ ${valor} criado para ${cliente.nome}`,
          ip: request.headers.get('x-forwarded-for') ?? undefined,
        },
      })

      return emp
    })

    return NextResponse.json({ data: emprestimo }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
    }
    console.error('Error creating loan:', error)
    return NextResponse.json({ error: 'Erro ao criar empréstimo' }, { status: 500 })
  }
}
