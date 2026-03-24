import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pixManager } from '@/lib/pix/manager'
import { calcLateFees } from '@/lib/calculations'
import QRCode from 'qrcode'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const valorPagamentoReq = body.valorPagamento ? parseFloat(body.valorPagamento) : null

    const parcela = await prisma.parcela.findUnique({
      where: { id },
      include: {
        emprestimo: {
          include: { cliente: true },
        },
      },
    })

    if (!parcela) {
      return NextResponse.json({ error: 'Parcela não encontrada' }, { status: 404 })
    }

    if (parcela.status === 'PAGO') {
      return NextResponse.json({ error: 'Parcela já paga' }, { status: 400 })
    }

    // Calculate late fees
    const { multa, jurosAtraso, valorTotal } = calcLateFees(
      parcela.valorOriginal,
      parcela.vencimento,
      parcela.emprestimo.multaPercent,
      parcela.emprestimo.jurosDiario
    )

    const valorCobradoMax = Math.round((valorTotal - (parcela.valorPago || 0)) * 100) / 100
    let valorCobrado = valorCobradoMax

    if (valorPagamentoReq && valorPagamentoReq > 0 && valorPagamentoReq <= valorCobradoMax) {
      valorCobrado = valorPagamentoReq
    }

    // Update parcela with fees
    await prisma.parcela.update({
      where: { id },
      data: { multa, jurosAtraso, valor: valorTotal },
    })

    // Create PIX charge
    const charge = await pixManager.createCharge(
      valorCobrado,
      `Parcela ${parcela.numero} - ${parcela.emprestimo.cliente.nome}`
    )

    // Save PIX txId
    await prisma.parcela.update({
      where: { id },
      data: { pixTxId: charge.txId },
    })

    // Generate QR code image if provider didn't return one
    let qrCodeImage = charge.qrCode
    if (!qrCodeImage && charge.qrCodeText) {
      try {
        qrCodeImage = await QRCode.toDataURL(charge.qrCodeText, { width: 300, margin: 2 })
      } catch (qrErr) {
        console.error('Error generating QR code image:', qrErr)
      }
    }

    return NextResponse.json({
      data: {
        txId: charge.txId,
        qrCode: qrCodeImage,
        qrCodeText: charge.qrCodeText,
        valor: valorCobrado,
        multa,
        jurosAtraso,
        provider: charge.provider,
      },
    })
  } catch (error) {
    console.error('Error creating PIX charge:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar cobrança PIX' },
      { status: 500 }
    )
  }
}
