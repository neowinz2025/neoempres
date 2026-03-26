import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const [
      totalEmprestimos,
      emprestimosAtivos,
      todasParcelas,
      parcelasPagas,
      parcelasAtrasadas,
      parcelasPendentes,
    ] = await Promise.all([
      prisma.emprestimo.findMany({ select: { valor: true, saldoDevedor: true, status: true } }),
      prisma.emprestimo.findMany({
        where: { status: 'ATIVO' },
        select: { valor: true, saldoDevedor: true },
      }),
      prisma.parcela.findMany({
        select: { valor: true, valorOriginal: true, valorPago: true, status: true, vencimento: true },
      }),
      prisma.parcela.findMany({
        where: { status: 'PAGO' },
        include: { emprestimo: { select: { valor: true, taxaJuros: true, tipo: true, numParcelas: true } } },
      }),
      prisma.parcela.findMany({
        where: { status: 'ATRASADO' },
        select: { valor: true },
      }),
      prisma.parcela.findMany({
        where: { status: 'PENDENTE', vencimento: { lt: new Date() } },
        select: { valor: true },
      }),
    ])

    const capitalEmprestado = totalEmprestimos.reduce((s, e) => s + (e.valor || 0), 0)
    const capitalEmAberto = emprestimosAtivos.reduce((s, e) => s + (e.saldoDevedor || 0), 0)
    const totalRecebido = parcelasPagas.reduce((s, p) => s + (p.valorPago || 0), 0)
    
    // Calculate Juros Recebidos (Base Interest + Late Fees)
    let jurosRecebidos = 0
    for (const p of parcelasPagas) {
      const vPago = p.valorPago || 0
      const vOriginal = p.valorOriginal || 0
      const e = p.emprestimo
      if (!e) continue

      const i = (e.taxaJuros || 0) / 100
      let parcelaInterest = 0

      if (e.tipo === 'BULLET') {
        // In Bullet, every installment's original value is just the interest (except the last one which has principal too)
        // But our calcBullet returns valorParcela = interest.
        // So interest is simply valorOriginal.
        // Wait, to be safe: interest = valor * i
        parcelaInterest = e.valor * i
      } else if (e.tipo === 'SIMPLE') {
        // interest = Principal * rate
        parcelaInterest = e.valor * i
      } else if (e.tipo === 'PRICE') {
        // For Price, we can approximate: TotalInterest / numParcelas
        // Or PMT - (Principal / numParcelas) -> Not accurate but better than 0
        const n = e.numParcelas || 1
        const pmt = e.valor * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
        const totalJurosPrevisto = (pmt * n) - e.valor
        parcelaInterest = totalJurosPrevisto / n
      }

      const lateFees = Math.max(0, vPago - vOriginal)
      const interestToRecord = Math.min(vPago, parcelaInterest)
      jurosRecebidos += (interestToRecord + lateFees)
    }

    const totalAtrasadas = parcelasAtrasadas.length + parcelasPendentes.length
    const valorAtrasado = [...parcelasAtrasadas, ...parcelasPendentes].reduce(
      (s, p) => s + (p.valor || 0),
      0
    )
    const inadimplencia =
      todasParcelas.length > 0
        ? Math.round((totalAtrasadas / todasParcelas.length) * 100 * 100) / 100
        : 0
    const roi = capitalEmprestado > 0
      ? Math.round((totalRecebido / capitalEmprestado) * 100 * 100) / 100
      : 0

    // Monthly data for charts (last 12 months)
    const now = new Date()
    const monthlyData = []
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthLabel = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

      monthlyData.push({
        mes: monthLabel,
        recebido: totalRecebido / 12,
        emprestado: capitalEmprestado / 12,
      })
    }

    // Count total clients
    const totalClientes = await prisma.cliente.count()

    return NextResponse.json({
      data: {
        capitalEmprestado: Math.round(capitalEmprestado * 100) / 100,
        capitalEmAberto: Math.round(capitalEmAberto * 100) / 100,
        totalRecebido: Math.round(totalRecebido * 100) / 100,
        jurosRecebidos: Math.round(Math.max(0, jurosRecebidos) * 100) / 100,
        parcelasAtrasadas: totalAtrasadas,
        valorAtrasado: Math.round(valorAtrasado * 100) / 100,
        inadimplencia,
        roi,
        totalClientes,
        totalEmprestimos: totalEmprestimos.length,
        monthlyData,
      },
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Erro interno ao carregar dashboard' }, { status: 500 })
  }
}
