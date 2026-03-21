import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'
import { differenceInDays } from 'date-fns'
import { calcLateFees, formatCurrency } from '@/lib/calculations'

// Vercel Cron: runs daily
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const results = { reminders: 0, charges: 0, urgents: 0, finals: 0, errors: 0 }

  try {
    // Get all pending/overdue installments with client info
    const parcelas = await prisma.parcela.findMany({
      where: { status: { in: ['PENDENTE', 'ATRASADO'] } },
      include: {
        emprestimo: {
          include: { cliente: true },
        },
      },
    })

    for (const parcela of parcelas) {
      const vencimento = new Date(parcela.vencimento)
      const diasDiff = differenceInDays(vencimento, now)
      const cliente = parcela.emprestimo.cliente
      let mensagem = ''
      let tipo = ''

      if (diasDiff === 1) {
        // 1 day before
        tipo = 'LEMBRETE'
        mensagem = `Olá ${cliente.nome}! 👋\n\nLembrete: sua parcela ${parcela.numero} no valor de ${formatCurrency(parcela.valor)} vence amanhã.\n\nEvite juros, pague em dia!`
        results.reminders++
      } else if (diasDiff === 0) {
        // Due date
        tipo = 'COBRANCA'
        mensagem = `Olá ${cliente.nome}! 📅\n\nSua parcela ${parcela.numero} no valor de ${formatCurrency(parcela.valor)} vence hoje!\n\nRealize o pagamento para evitar multa e juros.`
        results.charges++
      } else if (diasDiff === -3) {
        // 3 days late
        const { valorTotal } = calcLateFees(parcela.valorOriginal, vencimento, parcela.emprestimo.multaPercent, parcela.emprestimo.jurosDiario)
        tipo = 'URGENTE'
        mensagem = `⚠️ ${cliente.nome}, sua parcela ${parcela.numero} está 3 dias atrasada.\n\nValor atualizado: ${formatCurrency(valorTotal)}\n\nRegularize para evitar impacto no seu score.`
        results.urgents++

        // Update status to ATRASADO
        await prisma.parcela.update({
          where: { id: parcela.id },
          data: { status: 'ATRASADO' },
        })
      } else if (diasDiff === -7) {
        // 7 days late
        const { valorTotal } = calcLateFees(parcela.valorOriginal, vencimento, parcela.emprestimo.multaPercent, parcela.emprestimo.jurosDiario)
        tipo = 'FINAL'
        mensagem = `🚨 ${cliente.nome}, sua parcela ${parcela.numero} está 7 dias atrasada!\n\nValor atualizado: ${formatCurrency(valorTotal)}\n\nÚltimo aviso antes de ações de cobrança.`
        results.finals++
      }

      if (mensagem && cliente.telefone) {
        try {
          await sendWhatsApp(cliente.telefone, mensagem)
          await prisma.notificacao.create({
            data: {
              parcelaId: parcela.id,
              tipo,
              canal: 'WHATSAPP',
              status: 'ENVIADA',
              mensagem,
              enviadaEm: new Date(),
            },
          })
        } catch {
          results.errors++
          await prisma.notificacao.create({
            data: {
              parcelaId: parcela.id,
              tipo,
              canal: 'WHATSAPP',
              status: 'FALHA',
              mensagem,
            },
          })
        }
      }
    }

    // Auto-update overdue parcelas status
    await prisma.parcela.updateMany({
      where: {
        status: 'PENDENTE',
        vencimento: { lt: now },
      },
      data: { status: 'ATRASADO' },
    })

    await prisma.log.create({
      data: {
        acao: 'CRON_COBRANCA',
        detalhes: `Cobrança automática: ${JSON.stringify(results)}`,
      },
    })

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('[Cron] Error:', error)
    return NextResponse.json({ error: 'Cron error' }, { status: 500 })
  }
}
