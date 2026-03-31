import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { calcSimulacao } from '@/lib/calculations'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const clienteId = searchParams.get('clienteId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
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
    const body = await request.json()
    const { clienteId, valor, taxaJuros, tipo, numParcelas, dataInicio, multaPercent, jurosDiario, frequencia, produtoId, parcelasCustomizadas } = body

    if (!clienteId || !valor || taxaJuros === undefined || !tipo || !numParcelas) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: clienteId, valor, taxaJuros, tipo, numParcelas' },
        { status: 400 }
      )
    }

    // Validate numerical ranges
    if (typeof valor !== 'number' || valor <= 0 || valor > 10_000_000) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }
    if (typeof taxaJuros !== 'number' || taxaJuros < 0 || taxaJuros > 100) {
      return NextResponse.json({ error: 'Taxa de juros inválida' }, { status: 400 })
    }
    if (typeof numParcelas !== 'number' || numParcelas < 1 || numParcelas > 360) {
      return NextResponse.json({ error: 'Número de parcelas inválido' }, { status: 400 })
    }
    if (!['PRICE', 'SIMPLE', 'BULLET'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo de empréstimo inválido' }, { status: 400 })
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

    if (parcelasCustomizadas && Array.isArray(parcelasCustomizadas) && parcelasCustomizadas.length > 0) {
      finalParcelas = parcelasCustomizadas.map((p: any) => ({
        numero: p.numero,
        valor: p.valor,
        valorOriginal: p.valor,
        vencimento: new Date(p.vencimento),
      }))
      finalSaldoDevedor = finalParcelas.reduce((acc, curr) => acc + curr.valor, 0)
      finalValorParcela = finalParcelas[0].valor
    }

    const emprestimo = await prisma.emprestimo.create({
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

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'CRIAR_EMPRESTIMO',
        detalhes: `Empréstimo de R$ ${valor} criado para ${cliente.nome}`,
      },
    })

    return NextResponse.json({ data: emprestimo }, { status: 201 })
  } catch (error) {
    console.error('Error creating loan:', error)
    return NextResponse.json({ error: 'Erro ao criar empréstimo' }, { status: 500 })
  }
}
