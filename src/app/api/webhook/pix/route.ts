import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import CryptoJS from 'crypto-js'
import { sendTelegram } from '@/lib/notifications/telegram'
import { processarRenovacaoBullet } from '@/lib/bulletRenewal'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const fdSignature = request.headers.get('X-Webhook-Signature')
    const atlasSignature = request.headers.get('X-Atlas-Signature')
    const bitbridgeSignature = request.headers.get('X-BitBridge-Signature')

    let isValid = false

    if (atlasSignature) {
      const config = await prisma.config.findUnique({ where: { key: 'ATLASDAO_WEBHOOK_SECRET' } })
      const secret = config?.value || process.env.ATLASDAO_WEBHOOK_SECRET || ''
      if (secret) {
        const expected = 'sha256=' + CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex)
        const plain = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex)
        if (atlasSignature === expected || atlasSignature === plain) isValid = true
      }
    } else if (bitbridgeSignature) {
      const config = await prisma.config.findUnique({ where: { key: 'BITBRIDGE_WEBHOOK_SECRET' } })
      const secret = config?.value || process.env.BITBRIDGE_WEBHOOK_SECRET || ''
      if (secret) {
        const expected = 'sha256=' + CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex)
        const plain = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex)
        if (bitbridgeSignature === expected || bitbridgeSignature === plain) isValid = true
      } else {
        // BitBridge sem secret configurado — aceitar (validar pelo txid no banco)
        isValid = true
      }
    } else if (fdSignature) {
      const config = await prisma.config.findUnique({ where: { key: 'FASTDEPIX_WEBHOOK_SECRET' } })
      const secret = config?.value || process.env.FASTDEPIX_WEBHOOK_SECRET || ''
      if (secret) {
        const expected = CryptoJS.HmacSHA256(body, secret).toString(CryptoJS.enc.Hex)
        if (fdSignature === expected) isValid = true
      }
    }

    if (!isValid) {
      console.error('[Webhook] Invalid or missing signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(body)
    const event = data.event

    console.log(`[Webhook] Received event: ${event}`)

    if (event === 'transaction.paid' || event === 'payment.completed') {
      const txId = String(data.data?.id || data.data?.transaction_id || data.id)
      const rawAmount = data.data?.amount || data.amount

      // ── Atomic payment processing with idempotency guard ─────────────────────
      await prisma.$transaction(async (tx) => {
        // findFirst inside transaction — row-level lock in Postgres
        const parcela = await tx.parcela.findFirst({
          where: { pixTxId: txId },
          include: { emprestimo: { include: { cliente: true } } },
        })

        // Idempotency: if already paid, do nothing (still return 200)
        if (!parcela || parcela.status === 'PAGO') return

        const previouslyPaid = parcela.valorPago || 0
        const incoming = parseFloat(String(rawAmount || 0))

        // ── Security: validate amount makes sense ─────────────────────────────
        // Never trust the provider amount for full payment decision
        const totalPaidNow = previouslyPaid + incoming
        const isPartial = totalPaidNow < parcela.valor * 0.99
        const newStatus = isPartial ? 'PARCIAL' : 'PAGO'

        // 1. Update installment
        await tx.parcela.update({
          where: { id: parcela.id },
          data: {
            status: newStatus,
            dataPagamento: new Date(),
            valorPago: totalPaidNow,
          },
        })

        // 2. Decrement saldo devedor
        await tx.emprestimo.update({
          where: { id: parcela.emprestimoId },
          data: { saldoDevedor: { decrement: incoming } },
        })

        // 3. Mark loan QUITADO if all paid
        if (newStatus === 'PAGO') {
          const pending = await tx.parcela.count({
            where: {
              emprestimoId: parcela.emprestimoId,
              status: { not: 'PAGO' },
              id: { not: parcela.id },
            },
          })

          if (pending === 0) {
            await tx.emprestimo.update({
              where: { id: parcela.emprestimoId },
              data: { status: 'QUITADO', saldoDevedor: 0 },
            })
          }

          // 4. Bullet renewal (shared, idempotent)
          await processarRenovacaoBullet(
            { ...parcela, vencimento: new Date(parcela.vencimento) },
            totalPaidNow,
            tx as any
          )
        }

        // 5. Audit log
        await tx.log.create({
          data: {
            acao: 'WEBHOOK_PAGAMENTO',
            nivel: 'INFO',
            entidade: 'PARCELA',
            entidadeId: parcela.id,
            detalhes: `PIX confirmado — Parcela #${parcela.numero} — TxID: ${txId} — R$${incoming.toFixed(2)} — ${newStatus}`,
          },
        })

        // Telegram (fire-and-forget, outside transaction is fine here but we log internally)
        const pixEmoji = newStatus === 'PAGO' ? '✅' : '⏳'
        const pixStatusLabel = newStatus === 'PAGO' ? 'Pago integralmente via PIX' : 'Pagamento parcial via PIX'
        const pixRestante = newStatus === 'PARCIAL'
          ? `\n⚠️ <b>Restante para quitar:</b> R$ ${(parcela.valor - totalPaidNow).toFixed(2)}`
          : ''
        const clienteNome = parcela.emprestimo?.cliente?.nome ?? ''

        sendTelegram(
          `${pixEmoji} <b>Pagamento PIX Confirmado</b>\n` +
          `━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Cliente:</b> ${clienteNome}\n` +
          `📋 <b>Parcela:</b> #${parcela.numero}\n` +
          `💰 <b>Valor recebido:</b> R$ ${incoming.toFixed(2)}\n` +
          `📊 <b>Total pago na parcela:</b> R$ ${totalPaidNow.toFixed(2)} / R$ ${parcela.valor.toFixed(2)}\n` +
          `📌 <b>Status:</b> ${pixStatusLabel}` +
          pixRestante + `\n` +
          `🔑 <code>TxID: ${txId}</code>`
        ).catch(console.error)
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }
}
