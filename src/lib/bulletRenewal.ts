'use server'
// Shared Bullet Loan renewal logic — used by both manual payment and PIX webhook

import { addDays, addWeeks, addMonths } from 'date-fns'
import { prisma } from './prisma'

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

interface ParcelaComEmprestimo {
  id: string
  numero: number
  valor: number
  valorOriginal: number
  vencimento: Date
  emprestimoId: string
  emprestimo: {
    tipo: string
    valor: number
    jurosDiario: number
    frequencia: string
    numParcelas: number
  }
}

/**
 * If a BULLET loan installment is paid but only for interest (not principal+interest),
 * create the next interest-only installment automatically.
 */
export async function processarRenovacaoBullet(
  parcela: ParcelaComEmprestimo,
  totalPago: number,
  tx: PrismaTransactionClient
): Promise<void> {
  if (parcela.emprestimo.tipo !== 'BULLET') return

  const interest = parcela.emprestimo.valor * (parcela.emprestimo.jurosDiario / 100)
  const totalWithPrincipal = parcela.emprestimo.valor + interest

  // Only renew if partial payment (only interest paid, not principal)
  if (totalPago >= totalWithPrincipal * 0.99) return

  // Check if next installment already exists (idempotency guard)
  const nextOne = await tx.parcela.findFirst({
    where: { emprestimoId: parcela.emprestimoId, numero: parcela.numero + 1 },
  })
  if (nextOne) return

  // Calculate next due date based on frequency
  const freq = parcela.emprestimo.frequencia
  let nextDate = new Date(parcela.vencimento)
  if (freq === 'DIARIO') nextDate = addDays(nextDate, 1)
  else if (freq === 'SEMANAL') nextDate = addWeeks(nextDate, 1)
  else if (freq === 'QUINZENAL') nextDate = addDays(nextDate, 15)
  else nextDate = addMonths(nextDate, 1)

  await tx.parcela.create({
    data: {
      emprestimoId: parcela.emprestimoId,
      numero: parcela.numero + 1,
      valor: parcela.valor,
      valorOriginal: parcela.valorOriginal,
      vencimento: nextDate,
      status: 'PENDENTE',
    },
  })

  await tx.emprestimo.update({
    where: { id: parcela.emprestimoId },
    data: { numParcelas: { increment: 1 } },
  })
}
