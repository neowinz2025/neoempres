import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { sendTelegram } from '@/lib/notifications/telegram'

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
  const { status, valorPago, dataPagamento, formaPagamento, comprovante, vencimento, valorOriginal } = body

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
    
    // Updates adicionais para a funcionalidade de renegociação / registro de pagamento
    if (formaPagamento !== undefined) updateData.formaPagamento = formaPagamento
    if (comprovante !== undefined) updateData.comprovante = comprovante
    if (vencimento !== undefined) updateData.vencimento = new Date(vencimento)
    if (valorOriginal !== undefined) updateData.valorOriginal = parseFloat(valorOriginal)

    if (status === 'PAGO' || status === 'PARCIAL') {
      const isStatusChange = parcela.status !== status
      const previouslyPaid = parcela.valorPago || 0
      const currentTotalPaid = valorPago !== undefined ? valorPago : parcela.valor
      
      const newPaymentAmount = currentTotalPaid - previouslyPaid

      updateData.dataPagamento = dataPagamento ? new Date(dataPagamento) : new Date()
      updateData.valorPago = currentTotalPaid
      
      // Se não pagou tudo, força o status para PARCIAL
      if (currentTotalPaid < parcela.valor && status === 'PAGO') {
        updateData.status = 'PARCIAL'
      }

      if (newPaymentAmount > 0) {
        // Update saldo devedor
        await prisma.emprestimo.update({
          where: { id: parcela.emprestimoId },
          data: {
            saldoDevedor: { decrement: newPaymentAmount },
          },
        })
      }

      if (updateData.status === 'PAGO' || status === 'PAGO') {
        // Check if all installments are paid
        const pendingCount = await prisma.parcela.count({
          where: {
            emprestimoId: parcela.emprestimoId,
            status: { not: 'PAGO' },
            id: { not: id },
          },
        })

        if (pendingCount === 0 && currentTotalPaid >= parcela.valor) {
          await prisma.emprestimo.update({
            where: { id: parcela.emprestimoId },
            data: { status: 'QUITADO', saldoDevedor: 0 },
          })
        }
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
    
    if (status === 'PAGO' || status === 'PARCIAL') {
      await sendTelegram(
        `💵 <b>Pagamento Manual Registrado</b>\n\n<b>Parcela:</b> #${parcela.numero}\n<b>Valor Pago Orig./Atual:</b> R$ ${parcela.valor.toFixed(2)} / R$ ${Number(valorPago || parcela.valorPago || parcela.valor).toFixed(2)}\n<b>Status Atual:</b> ${status === 'PARCIAL' ? 'Parcial' : 'Pago'}\n<b>Via:</b> ${formaPagamento || 'Painel Admin'}`
      )
    }

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating parcela:', error)
    return NextResponse.json({ error: 'Erro ao atualizar parcela' }, { status: 500 })
  }
}
