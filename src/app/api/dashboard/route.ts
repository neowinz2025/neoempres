import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // ── All aggregations pushed to the database — no more full table scan ──────
    const [
      empAgg,
      empAtivoAgg,
      parcelasGrouped,
      totalClientes,
    ] = await Promise.all([
      // Total emprestado e saldo geral
      prisma.emprestimo.aggregate({
        _sum: { valor: true, saldoDevedor: true },
      }),
      // Apenas ativos
      prisma.emprestimo.aggregate({
        where: { status: 'ATIVO' },
        _sum: { saldoDevedor: true },
      }),
      // Parcelas agrupadas por status
      prisma.parcela.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { valor: true, valorPago: true },
      }),
      prisma.cliente.count(),
    ])

    // Número de empréstimos ativos com ao menos 1 parcela ATRASADA (métrica real de inadimplência)
    const [emprestimosAtivosTotal, emprestimosInadimplentes] = await Promise.all([
      prisma.emprestimo.count({ where: { status: { in: ['ATIVO', 'RENEGOCIADO'] } } }),
      prisma.emprestimo.count({
        where: {
          status: { in: ['ATIVO', 'RENEGOCIADO'] },
          parcelas: { some: { status: 'ATRASADO' } },
        },
      }),
    ])

    const capitalEmprestado = empAgg._sum.valor ?? 0
    const capitalEmAberto = empAtivoAgg._sum.saldoDevedor ?? 0

    // Map grouped results
    const byStatus = Object.fromEntries(
      parcelasGrouped.map((g) => [
        g.status,
        { count: g._count.id, valor: g._sum.valor ?? 0, valorPago: g._sum.valorPago ?? 0 },
      ])
    )

    const totalRecebido = byStatus['PAGO']?.valorPago ?? 0

    // ✅ valorAtrasado: apenas parcelas com status ATRASADO (cron já as marcou)
    // Parcelas PENDENTE ainda não vencidas NÃO entram aqui.
    const valorAtrasadoStat = byStatus['ATRASADO']?.valor ?? 0
    const totalAtrasadas = byStatus['ATRASADO']?.count ?? 0

    // Parcelas parcialmente pagas também têm saldo em risco
    const valorParcial = (byStatus['PARCIAL']?.valor ?? 0) - (byStatus['PARCIAL']?.valorPago ?? 0)

    const totalParcelas = parcelasGrouped.reduce((s, g) => s + g._count.id, 0)

    // ✅ Inadimplência = % de contratos ativos com ao menos 1 parcela ATRASADA
    const inadimplencia =
      emprestimosAtivosTotal > 0
        ? Math.round((emprestimosInadimplentes / emprestimosAtivosTotal) * 100 * 100) / 100
        : 0

    // Juros aproximados — evitamos carregar todas as linhas em memória
    const jurosRecebidos = Math.max(0, totalRecebido - capitalEmprestado * 0.7)

    const roi =
      capitalEmprestado > 0
        ? Math.round((totalRecebido / capitalEmprestado) * 100 * 100) / 100
        : 0

    // ── Monthly data — direct DB aggregation ──────────────────────────────────
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11)
    twelveMonthsAgo.setDate(1)
    twelveMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyPago = await prisma.parcela.groupBy({
      by: ['dataPagamento'],
      where: {
        status: 'PAGO',
        dataPagamento: { gte: twelveMonthsAgo },
      },
      _sum: { valorPago: true },
    })

    const monthlyEmp = await prisma.emprestimo.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: twelveMonthsAgo } },
      _sum: { valor: true },
    })

    // Build monthly buckets
    const bucket: Record<string, { recebido: number; emprestado: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      bucket[key] = { recebido: 0, emprestado: 0 }
    }

    monthlyPago.forEach((r) => {
      if (!r.dataPagamento) return
      const d = new Date(r.dataPagamento)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (bucket[key]) bucket[key].recebido += r._sum.valorPago ?? 0
    })

    monthlyEmp.forEach((r) => {
      const d = new Date(r.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (bucket[key]) bucket[key].emprestado += r._sum.valor ?? 0
    })

    const monthlyData = Object.entries(bucket).map(([key, val]) => {
      const [year, month] = key.split('-')
      const d = new Date(parseInt(year), parseInt(month) - 1, 1)
      return {
        mes: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        recebido: Math.round(val.recebido * 100) / 100,
        emprestado: Math.round(val.emprestado * 100) / 100,
      }
    })

    const totalEmprestimos = await prisma.emprestimo.count()

    return NextResponse.json({
      data: {
        capitalEmprestado: Math.round(capitalEmprestado * 100) / 100,
        capitalEmAberto: Math.round(capitalEmAberto * 100) / 100,
        totalRecebido: Math.round(totalRecebido * 100) / 100,
        jurosRecebidos: Math.round(jurosRecebidos * 100) / 100,
        parcelasAtrasadas: totalAtrasadas,
        valorAtrasado: Math.round(valorAtrasadoStat * 100) / 100,
        valorParcialRisco: Math.round(valorParcial * 100) / 100, // saldo restante de pagamentos parciais
        inadimplencia, // % de contratos ativos com ao menos 1 parcela ATRASADA
        emprestimosInadimplentes, // quantidade absoluta de contratos inadimplentes
        emprestimosAtivos: emprestimosAtivosTotal,
        roi,
        totalClientes,
        totalEmprestimos,
        monthlyData,
      },
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erro interno ao carregar dashboard' }, { status: 500 })
  }
}
