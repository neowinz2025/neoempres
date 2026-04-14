import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { UpdateParcelaSchema } from '@/lib/validators'
import { processarRenovacaoBullet } from '@/lib/bulletRenewal'
import { sendTelegram } from '@/lib/notifications/telegram'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { id } = await params

  // Validate schema
  const rawBody = await request.json()
  const parsed = UpdateParcelaSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { status, valorPago, dataPagamento, formaPagamento, comprovante, vencimento, valorOriginal } = parsed.data

  try {
    const parcela = await prisma.parcela.findUnique({
      where: { id },
      include: { 
        emprestimo: {
          include: { cliente: true }
        }
      },
    })

    if (!parcela) {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 })
    }

    // ── Non-payment edits (vencimento/valorOriginal only) ─────────────────────
    if (!status && (vencimento !== undefined || valorOriginal !== undefined)) {
      const updated = await prisma.parcela.update({
        where: { id },
        data: {
          ...(vencimento !== undefined && { vencimento: new Date(vencimento) }),
          ...(valorOriginal !== undefined && { valorOriginal }),
        },
      })

      await prisma.log.create({
        data: {
          userId: session.userId,
          acao: 'EDITAR_PARCELA',
          nivel: 'INFO',
          entidade: 'PARCELA',
          entidadeId: id,
          detalhes: `Parcela #${parcela.numero} editada`,
        },
      })

      return NextResponse.json({ data: updated })
    }

    // ── Payment flow — ATOMIC ─────────────────────────────────────────────────
    if (status === 'PAGO' || status === 'PARCIAL') {
      const previouslyPaid = parcela.valorPago || 0
      const currentTotalPaid = valorPago !== undefined ? valorPago : parcela.valor
      const newPaymentAmount = currentTotalPaid - previouslyPaid

      // Enforce correct partial status
      const finalStatus = currentTotalPaid < parcela.valor ? 'PARCIAL' : 'PAGO'

      const updated = await prisma.$transaction(async (tx) => {
        // 1. Update installment
        const upd = await tx.parcela.update({
          where: { id },
          data: {
            status: finalStatus,
            dataPagamento: dataPagamento ? new Date(dataPagamento) : new Date(),
            valorPago: currentTotalPaid,
            ...(formaPagamento !== undefined && { formaPagamento }),
            ...(comprovante !== undefined && { comprovante }),
          },
        })

        // 2. Decrement saldo devedor (only for new payment amount)
        if (newPaymentAmount > 0) {
          await tx.emprestimo.update({
            where: { id: parcela.emprestimoId },
            data: { saldoDevedor: { decrement: newPaymentAmount } },
          })
        }

        // 3. Mark loan as QUITADO if all installments are paid
        if (finalStatus === 'PAGO') {
          const pendingCount = await tx.parcela.count({
            where: {
              emprestimoId: parcela.emprestimoId,
              status: { not: 'PAGO' },
              id: { not: id },
            },
          })

          if (pendingCount === 0 && currentTotalPaid >= parcela.valor) {
            await tx.emprestimo.update({
              where: { id: parcela.emprestimoId },
              data: { status: 'QUITADO', saldoDevedor: 0 },
            })
          }

          // 4. Bullet renewal (idempotent — checked inside)
          await processarRenovacaoBullet(
            { ...parcela, vencimento: new Date(parcela.vencimento) },
            currentTotalPaid,
            tx as any
          )
        }

        // 5. Audit log
        await tx.log.create({
          data: {
            userId: session.userId,
            acao: 'PAGAMENTO_PARCELA',
            nivel: 'INFO',
            entidade: 'PARCELA',
            entidadeId: id,
            detalhes: `Parcela #${parcela.numero} do Empréstimo ${parcela.emprestimoId} — R$${currentTotalPaid.toFixed(2)} — ${finalStatus}`,
            ip: request.headers.get('x-forwarded-for') ?? undefined,
          },
        })

        return upd
      })

      // Send Telegram notification (outside transaction — non-critical)
      const cliente = (parcela as any).emprestimo?.cliente
      const clienteNome = cliente?.nome ?? '—'
      const emoji = finalStatus === 'PAGO' ? '✅' : '⏳'
      const statusLabel = finalStatus === 'PAGO' ? 'Pago integralmente' : 'Pagamento parcial'
      const restante = finalStatus === 'PARCIAL'
        ? `\n💳 <b>Saldo restante:</b> R$ ${(parcela.valor - currentTotalPaid).toFixed(2)}`
        : ''

      sendTelegram(
        `${emoji} <b>Pagamento Registrado</b>\n` +
        `━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Cliente:</b> ${clienteNome}\n` +
        `📋 <b>Parcela:</b> #${parcela.numero}\n` +
        `💰 <b>Valor pago agora:</b> R$ ${(currentTotalPaid - (parcela.valorPago || 0) > 0 ? currentTotalPaid - (parcela.valorPago || 0) : currentTotalPaid).toFixed(2)}\n` +
        `📊 <b>Total pago na parcela:</b> R$ ${currentTotalPaid.toFixed(2)}\n` +
        `📌 <b>Status:</b> ${statusLabel}` +
        restante + `\n` +
        `💳 <b>Forma:</b> ${formaPagamento || 'Painel Administrativo'}`
      ).catch(console.error)

      // ─────────────────────────────────────────────────────────────
      // Z-API / WhatsApp: Envio automático de Recibo de Pagamento!
      // ─────────────────────────────────────────────────────────────
      if (cliente && cliente.telefone && cliente.notificarWpp) {
        let msgWpp = ''
        if (finalStatus === 'PAGO') {
          msgWpp = `✅ *PAGAMENTO CONFIRMADO*\n\nOlá *${cliente.nome}*,\nRecebemos o pagamento da *Parcela #${parcela.numero}* no valor de R$ ${currentTotalPaid.toFixed(2).replace('.', ',')}.\n\nAgradecemos a sua preferência e pontualidade! 🤝`
        } else if (finalStatus === 'PARCIAL') {
          msgWpp = `⏳ *PAGAMENTO PARCIAL RECEBIDO*\n\nOlá *${cliente.nome}*,\nRecebemos uma parte do pagamento referente à Parcela #${parcela.numero} (R$ ${currentTotalPaid.toFixed(2).replace('.', ',')}).\n\n💳 *Saldo restante desta parcela:* R$ ${(parcela.valor - currentTotalPaid).toFixed(2).replace('.', ',')}\n\nAgradecemos o envio!`
        }
        
        if (msgWpp) {
           sendWhatsApp(cliente.telefone, msgWpp).catch(err => console.error('[Z-API RECIBO]', err))
        }
      }

      return NextResponse.json({ data: updated })
    }

    // ── Simple status update (e.g. PENDENTE/ATRASADO) ─────────────────────────
    const updated = await prisma.parcela.update({
      where: { id },
      data: { ...(status && { status }) },
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('Error updating parcela:', error)
    return NextResponse.json({ error: 'Erro ao atualizar parcela' }, { status: 500 })
  }
}
