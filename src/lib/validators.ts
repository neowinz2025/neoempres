// Backend validation schemas using Zod
import { z } from 'zod'

// ── Clientes ──────────────────────────────────────────────────────────────────
export const CreateClienteSchema = z.object({
  nome: z.string().min(2).max(200),
  telefone: z.string().min(8).max(20),
  notificarWpp: z.boolean().optional(),
})

// ── Empréstimos ───────────────────────────────────────────────────────────────
export const ParcelaCustomSchema = z.object({
  numero: z.number().int().positive(),
  valor: z.number().positive().max(10_000_000),
  vencimento: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
})

export const CreateEmprestimoSchema = z.object({
  clienteId: z.string().cuid(),
  valor: z.number().positive().max(10_000_000),
  taxaJuros: z.number().min(0).max(100),
  tipo: z.enum(['PRICE', 'SIMPLE', 'BULLET']),
  numParcelas: z.number().int().min(1).max(360),
  dataInicio: z.string().optional(),
  multaPercent: z.number().min(0).max(30).optional(),
  jurosDiario: z.number().min(0).max(10).optional(),
  frequencia: z.enum(['DIARIO', 'SEMANAL', 'QUINZENAL', 'MENSAL']).optional(),
  produtoId: z.string().cuid().optional().nullable(),
  parcelasCustomizadas: z.array(ParcelaCustomSchema).optional(),
})

// Validate custom installments sum is reasonable vs loan value
export function validateParcelasCustomizadas(
  parcelas: z.infer<typeof ParcelaCustomSchema>[],
  valor: number
): string | null {
  if (!parcelas.length) return 'Array de parcelas vazio'
  if (parcelas.some((p) => p.valor <= 0)) return 'Parcela com valor inválido'
  if (parcelas.some((p) => !p.vencimento)) return 'Parcela sem vencimento'

  const total = parcelas.reduce((s, p) => s + p.valor, 0)
  if (total < valor * 0.5) return `Soma das parcelas (${total.toFixed(2)}) é menor que 50% do valor do empréstimo`
  if (total > valor * 10) return 'Soma das parcelas excede 10x o valor do empréstimo'

  return null // valid
}

// ── Parcelas ──────────────────────────────────────────────────────────────────
export const UpdateParcelaSchema = z.object({
  status: z.enum(['PAGO', 'PARCIAL', 'PENDENTE', 'ATRASADO']).optional(),
  valorPago: z.number().min(0).max(10_000_000).optional(),
  dataPagamento: z.string().optional(),
  formaPagamento: z.string().max(50).optional(),
  comprovante: z.string().optional(),
  vencimento: z.string().optional(),
  valorOriginal: z.number().positive().max(10_000_000).optional(),
})

// ── Renegociação ──────────────────────────────────────────────────────────────
export const RenegociarSchema = z.object({
  renegociar: z.literal(true),
  valor: z.number().positive().max(10_000_000).optional(),
  taxaJuros: z.number().min(0).max(100).optional(),
  tipo: z.enum(['PRICE', 'SIMPLE', 'BULLET']).optional(),
  numParcelas: z.number().int().min(1).max(360).optional(),
  dataInicio: z.string().optional(),
  frequencia: z.enum(['DIARIO', 'SEMANAL', 'QUINZENAL', 'MENSAL']).optional(),
  parcelasCustomizadas: z.array(ParcelaCustomSchema).optional(),
})

export const UpdateEmprestimoSchema = z.union([
  RenegociarSchema,
  z.object({
    status: z.enum(['ATIVO', 'QUITADO', 'RENEGOCIADO', 'INADIMPLENTE']).optional(),
    multaPercent: z.number().min(0).max(30).optional(),
    jurosDiario: z.number().min(0).max(10).optional(),
  }),
])
