import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import CryptoJS from 'crypto-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('X-Webhook-Signature') || ''

    // Validate HMAC signature
    const config = await prisma.config.findUnique({ where: { key: 'FASTDEPIX_WEBHOOK_SECRET' } })
    const secret = config?.value || process.env.FASTDEPIX_WEBHOOK_SECRET || ''
    if (secret) {
      const expectedSignature = CryptoJS.HmacSHA256(body, secret).toString()
      if (signature !== expectedSignature) {
        console.error('[Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const data = JSON.parse(body)
    const event = data.event

    console.log(`[Webhook] Received event: ${event}`)

    if (event === 'transaction.paid') {
      const txId = String(data.data?.id || data.data?.transaction_id)
      const amount = data.data?.amount

      // Find parcela by pixTxId
      const parcela = await prisma.parcela.findFirst({
        where: { pixTxId: txId },
        include: { emprestimo: true },
      })

      if (parcela && parcela.status !== 'PAGO') {
        // Mark as paid
        await prisma.parcela.update({
          where: { id: parcela.id },
          data: {
            status: 'PAGO',
            dataPagamento: new Date(),
            valorPago: amount || parcela.valor,
          },
        })

        // Update saldo devedor
        const paid = amount || parcela.valor
        await prisma.emprestimo.update({
          where: { id: parcela.emprestimoId },
          data: {
            saldoDevedor: { decrement: paid },
          },
        })

        // Check if all installments paid
        const pending = await prisma.parcela.count({
          where: {
            emprestimoId: parcela.emprestimoId,
            status: { not: 'PAGO' },
          },
        })

        if (pending === 0) {
          await prisma.emprestimo.update({
            where: { id: parcela.emprestimoId },
            data: { status: 'QUITADO', saldoDevedor: 0 },
          })
        }

        await prisma.log.create({
          data: {
            acao: 'WEBHOOK_PAGAMENTO',
            detalhes: `Pagamento PIX confirmado - Parcela #${parcela.numero} - TxID: ${txId} - R$ ${paid}`,
          },
        })

        console.log(`[Webhook] Payment confirmed for parcela ${parcela.id}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Webhook] Error:', error)
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }
}
