import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

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
  const { status, valorPago, dataPagamento } = body

  try {
    const parcela = await prisma.parcela.findUnique({
      where: { id },
      include: { emprestimo: true },
    })

    if (!parcela) {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (status) updateData.status = status
    if (valorPago !== undefined) updateData.valorPago = valorPago
    if (dataPagamento) updateData.dataPagamento = new Date(dataPagamento)

    if (status === 'PAGO') {
      updateData.dataPagamento = dataPagamento ? new Date(dataPagamento) : new Date()
      updateData.valorPago = valorPago || parcela.valor

      // Update saldo devedor
      const paid = valorPago || parcela.valor
      await prisma.emprestimo.update({
        where: { id: parcela.emprestimoId },
        data: {
          saldoDevedor: { decrement: paid },
        },
      })

      // Check if all installments are paid
      const pendingCount = await prisma.parcela.count({
        where: {
          emprestimoId: parcela.emprestimoId,
          status: { not: 'PAGO' },
          id: { not: id },
        },
      })

      if (pendingCount === 0) {
        await prisma.emprestimo.update({
          where: { id: parcela.emprestimoId },
          data: { status: 'QUITADO', saldoDevedor: 0 },
        })
      }
    }

    const updated = await prisma.parcela.update({
      where: { id },
      data: updateData,
    })

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'ATUALIZAR_PARCELA',
        detalhes: `Parcela #${parcela.numero} do empréstimo ${parcela.emprestimoId} atualizada para ${status}`,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating parcela:', error)
    return NextResponse.json({ error: 'Erro ao atualizar parcela' }, { status: 500 })
  }
}
