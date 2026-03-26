import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const cliente = await prisma.cliente.findUnique({
    where: { token },
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
    return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  }

  // Calculate summary
  const totalDevedor = cliente.emprestimos
    .filter((e) => e.status === 'ATIVO')
    .reduce((s, e) => s + e.saldoDevedor, 0)

  const todasParcelas = cliente.emprestimos.flatMap((e) => e.parcelas)
  const proximaParcela = todasParcelas
    .filter((p) => p.status === 'PENDENTE' || p.status === 'ATRASADO')
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())[0]

  const historico = todasParcelas
    .filter((p) => p.status === 'PAGO')
    .sort((a, b) => new Date(b.dataPagamento!).getTime() - new Date(a.dataPagamento!).getTime())

  return NextResponse.json({
    data: {
      nome: cliente.nome,
      telefone: cliente.telefone || '',
      saldoDevedor: Math.round(totalDevedor * 100) / 100,
      proximaParcela: proximaParcela || null,
      emprestimos: cliente.emprestimos.map((e) => ({
        id: e.id,
        valor: e.valor,
        valorTotal: e.saldoDevedor + e.parcelas.filter(p => p.status === 'PAGO' || p.status === 'PARCIAL').reduce((s, p) => s + (p.valorPago || 0), 0),
        tipo: e.tipo,
        status: e.status,
        saldoDevedor: e.saldoDevedor,
        taxaJuros: e.taxaJuros,
        jurosDiario: e.jurosDiario,
        numParcelas: e.parcelas.length,
        totalPago: e.parcelas.reduce((s, p) => s + (p.valorPago || 0), 0),
        parcelas: e.parcelas,
      })),
      historico: historico.slice(0, 20),
    },
  })
}
