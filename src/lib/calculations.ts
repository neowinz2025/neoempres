import { addMonths, addDays, addWeeks, differenceInDays, isAfter } from 'date-fns'

type Frequencia = 'DIARIO' | 'SEMANAL' | 'MENSAL'

function getVencimento(inicio: Date, n: number, freq: Frequencia): Date {
  if (freq === 'DIARIO') return addDays(inicio, n)
  if (freq === 'SEMANAL') return addWeeks(inicio, n)
  return addMonths(inicio, n)
}

export interface ParcelaCalc {
  numero: number
  valor: number
  vencimento: Date
}

export interface SimulacaoResult {
  valorParcela: number
  totalPago: number
  totalJuros: number
  parcelas: ParcelaCalc[]
}

/**
 * Tabela Price (French Amortization System)
 * PMT = PV * [i(1+i)^n] / [(1+i)^n - 1]
 */
export function calcPrice(
  valor: number,
  taxa: number,
  numParcelas: number,
  dataInicio: Date = new Date(),
  frequencia: Frequencia = 'MENSAL'
): SimulacaoResult {
  const i = taxa / 100
  const pmt = valor * (i * Math.pow(1 + i, numParcelas)) / (Math.pow(1 + i, numParcelas) - 1)
  const valorParcela = Math.round(pmt * 100) / 100
  const totalPago = Math.round(valorParcela * numParcelas * 100) / 100
  const totalJuros = Math.round((totalPago - valor) * 100) / 100

  const parcelas: ParcelaCalc[] = []
  for (let n = 1; n <= numParcelas; n++) {
    parcelas.push({
      numero: n,
      valor: valorParcela,
      vencimento: getVencimento(dataInicio, n, frequencia),
    })
  }

  return { valorParcela, totalPago, totalJuros, parcelas }
}

/**
 * Simple interest: each installment = principal/n + (principal * rate)
 */
export function calcSimple(
  valor: number,
  taxa: number,
  numParcelas: number,
  dataInicio: Date = new Date(),
  frequencia: Frequencia = 'MENSAL'
): SimulacaoResult {
  const i = taxa / 100
  const jurosMensal = valor * i
  const amortizacao = valor / numParcelas
  const valorParcela = Math.round((amortizacao + jurosMensal) * 100) / 100
  const totalPago = Math.round(valorParcela * numParcelas * 100) / 100
  const totalJuros = Math.round((totalPago - valor) * 100) / 100

  const parcelas: ParcelaCalc[] = []
  for (let n = 1; n <= numParcelas; n++) {
    parcelas.push({
      numero: n,
      valor: valorParcela,
      vencimento: getVencimento(dataInicio, n, frequencia),
    })
  }

  return { valorParcela, totalPago, totalJuros, parcelas }
}

/**
 * Bullet: single payment at the end
 */
export function calcBullet(
  valor: number,
  taxa: number,
  numParcelas: number,
  dataInicio: Date = new Date(),
  frequencia: Frequencia = 'MENSAL'
): SimulacaoResult {
  const i = taxa / 100
  const jurosMensal = Math.round(valor * i * 100) / 100
  const totalJuros = Math.round(jurosMensal * numParcelas * 100) / 100
  const totalPago = Math.round((valor + totalJuros) * 100) / 100

  const parcelas: ParcelaCalc[] = []
  for (let n = 1; n <= numParcelas; n++) {
    const isUltima = n === numParcelas
    parcelas.push({
      numero: n,
      valor: isUltima ? Math.round((valor + jurosMensal) * 100) / 100 : jurosMensal,
      vencimento: getVencimento(dataInicio, n, frequencia),
    })
  }

  return { valorParcela: jurosMensal, totalPago, totalJuros, parcelas }
}

/**
 * Calculate simulation based on type
 */
export function calcSimulacao(
  tipo: 'PRICE' | 'SIMPLE' | 'BULLET',
  valor: number,
  taxa: number,
  numParcelas: number,
  dataInicio: Date = new Date(),
  frequencia: Frequencia = 'MENSAL'
): SimulacaoResult {
  switch (tipo) {
    case 'PRICE':
      return calcPrice(valor, taxa, numParcelas, dataInicio, frequencia)
    case 'SIMPLE':
      return calcSimple(valor, taxa, numParcelas, dataInicio, frequencia)
    case 'BULLET':
      return calcBullet(valor, taxa, numParcelas, dataInicio, frequencia)
  }
}

/**
 * Calculate late fees for an overdue installment
 */
export function calcLateFees(
  valorOriginal: number,
  vencimento: Date,
  multaPercent: number = 2.0,
  jurosDiarioPercent: number = 0.033
): { multa: number; jurosAtraso: number; valorTotal: number; diasAtraso: number } {
  const hoje = new Date()
  if (!isAfter(hoje, vencimento)) {
    return { multa: 0, jurosAtraso: 0, valorTotal: valorOriginal, diasAtraso: 0 }
  }

  const diasAtraso = differenceInDays(hoje, vencimento)
  const multa = Math.round(valorOriginal * (multaPercent / 100) * 100) / 100
  const jurosAtraso = Math.round(valorOriginal * (jurosDiarioPercent / 100) * diasAtraso * 100) / 100
  const valorTotal = Math.round((valorOriginal + multa + jurosAtraso) * 100) / 100

  return { multa, jurosAtraso, valorTotal, diasAtraso }
}

/**
 * Calculate client score based on payment history
 */
export function calcScore(
  totalParcelas: number,
  parcelasEmDia: number,
  parcelasAtrasadas: number
): 'A' | 'B' | 'C' | 'D' {
  if (totalParcelas === 0) return 'C'

  const taxaEmDia = parcelasEmDia / totalParcelas
  const taxaAtraso = parcelasAtrasadas / totalParcelas

  if (taxaEmDia >= 0.95 && taxaAtraso === 0) return 'A'
  if (taxaEmDia >= 0.80 && taxaAtraso <= 0.1) return 'B'
  if (taxaEmDia >= 0.60) return 'C'
  return 'D'
}

/**
 * Format currency BRL
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
