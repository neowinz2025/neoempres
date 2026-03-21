import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tipo = searchParams.get('tipo') || 'carteira'
  const formato = searchParams.get('formato') || 'json'

  let data: Record<string, unknown>[] = []

  switch (tipo) {
    case 'carteira': {
      const emprestimos = await prisma.emprestimo.findMany({
        where: { status: 'ATIVO' },
        include: { cliente: { select: { nome: true, telefone: true, score: true } } },
      })
      data = emprestimos.map((e) => ({
        Cliente: e.cliente.nome,
        Telefone: e.cliente.telefone,
        Score: e.cliente.score,
        Valor: e.valor,
        Taxa: `${e.taxaJuros}%`,
        Tipo: e.tipo,
        Parcelas: e.numParcelas,
        'Saldo Devedor': e.saldoDevedor,
        Status: e.status,
      }))
      break
    }
    case 'inadimplencia': {
      const atrasadas = await prisma.parcela.findMany({
        where: {
          OR: [
            { status: 'ATRASADO' },
            { status: 'PENDENTE', vencimento: { lt: new Date() } },
          ],
        },
        include: {
          emprestimo: {
            include: { cliente: { select: { nome: true, telefone: true } } },
          },
        },
        orderBy: { vencimento: 'asc' },
      })
      data = atrasadas.map((p) => ({
        Cliente: p.emprestimo.cliente.nome,
        Telefone: p.emprestimo.cliente.telefone,
        Parcela: p.numero,
        Valor: p.valor,
        Vencimento: p.vencimento.toISOString().split('T')[0],
        'Dias Atraso': Math.floor(
          (Date.now() - new Date(p.vencimento).getTime()) / (1000 * 60 * 60 * 24)
        ),
        Status: p.status,
      }))
      break
    }
    case 'fluxo': {
      const parcelas = await prisma.parcela.findMany({
        where: { status: { in: ['PENDENTE', 'ATRASADO'] } },
        include: {
          emprestimo: {
            include: { cliente: { select: { nome: true } } },
          },
        },
        orderBy: { vencimento: 'asc' },
      })
      data = parcelas.map((p) => ({
        Cliente: p.emprestimo.cliente.nome,
        Parcela: p.numero,
        Valor: p.valor,
        Vencimento: p.vencimento.toISOString().split('T')[0],
        Status: p.status,
      }))
      break
    }
  }

  if (formato === 'json') {
    return NextResponse.json({ data })
  }

  // Generate Excel/CSV
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório')

  if (formato === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=relatorio_${tipo}.csv`,
      },
    })
  }

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=relatorio_${tipo}.xlsx`,
    },
  })
}
