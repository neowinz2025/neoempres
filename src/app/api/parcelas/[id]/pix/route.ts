import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pixManager } from '@/lib/pix/manager'
import { calcLateFees } from '@/lib/calculations'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Update parcela with fees
    await prisma.parcela.update({
      where: { id },
      data: { multa, jurosAtraso, valor: valorTotal },
    })

    // Create PIX charge
    const charge = await pixManager.createCharge(
      valorTotal,
      `Parcela ${parcela.numero} - ${parcela.emprestimo.cliente.nome}`
    )

    // Save PIX txId
    await prisma.parcela.update({
      where: { id },
      data: { pixTxId: charge.txId },
    })

    return NextResponse.json({
      data: {
        txId: charge.txId,
        qrCode: charge.qrCode,
        qrCodeText: charge.qrCodeText,
        valor: valorTotal,
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
