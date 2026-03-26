import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.nextUrl.searchParams.get('token')
  const session = await getSession()

  try {
    const parcela = await prisma.parcela.findUnique({
      where: { id },
      include: {
        emprestimo: {
          include: { cliente: true }
        }
      }
    })

    if (!parcela) {
      return NextResponse.json({ error: 'Comprovante não encontrado' }, { status: 404 })
    }

    // Security Check: Admin session OR valid token
    const isAuthorized = 
      (session && session.role === 'ADMIN') || 
      (token && (parcela.emprestimo.token === token || parcela.emprestimo.cliente.token === token))

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (parcela.status !== 'PAGO' && parcela.status !== 'PARCIAL') {
      return NextResponse.json({ error: 'Esta parcela ainda não possui pagamento registrado' }, { status: 400 })
    }

    return NextResponse.json({
      data: {
        id: parcela.id,
        numero: parcela.numero,
        totalParcelas: parcela.emprestimo.numParcelas,
        valorPago: parcela.valorPago,
        dataPagamento: parcela.dataPagamento,
        formaPagamento: parcela.formaPagamento,
        clienteNome: parcela.emprestimo.cliente.nome,
        emprestimoTipo: parcela.emprestimo.tipo,
        vencimento: parcela.vencimento
      }
    })
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados do comprovante' }, { status: 500 })
  }
}
