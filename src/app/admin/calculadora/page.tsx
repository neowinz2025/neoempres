'use client'

import { useState, useEffect } from 'react'

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function CalculadoraPage() {
  const [valor, setValor] = useState('10000')
  const [taxa, setTaxa] = useState('5')
  const [parcelas, setParcelas] = useState('12')
  const [tipo, setTipo] = useState<'PRICE' | 'SIMPLE' | 'BULLET'>('PRICE')
  const [result, setResult] = useState<{
    valorParcela: number; totalPago: number; totalJuros: number
    tabela: { numero: number; parcela: number; juros: number; amort: number; saldo: number }[]
  } | null>(null)

  useEffect(() => {
    const v = parseFloat(valor)
    const t = parseFloat(taxa)
    const n = parseInt(parcelas)
    if (!v || !t || !n || v <= 0 || n <= 0) { setResult(null); return }

    const i = t / 100
    let valorParcela: number, totalPago: number
    const tabela: { numero: number; parcela: number; juros: number; amort: number; saldo: number }[] = []

    if (tipo === 'PRICE') {
      valorParcela = v * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
      totalPago = valorParcela * n
      let saldo = v
      for (let k = 1; k <= n; k++) {
        const juros = saldo * i
        const amort = valorParcela - juros
        saldo -= amort
        tabela.push({ numero: k, parcela: Math.round(valorParcela * 100) / 100, juros: Math.round(juros * 100) / 100, amort: Math.round(amort * 100) / 100, saldo: Math.max(0, Math.round(saldo * 100) / 100) })
      }
    } else if (tipo === 'SIMPLE') {
      const jurosMensal = v * i
      const amortMensal = v / n
      valorParcela = amortMensal + jurosMensal
      totalPago = valorParcela * n
      let saldo = v
      for (let k = 1; k <= n; k++) {
        saldo -= amortMensal
        tabela.push({ numero: k, parcela: Math.round(valorParcela * 100) / 100, juros: Math.round(jurosMensal * 100) / 100, amort: Math.round(amortMensal * 100) / 100, saldo: Math.max(0, Math.round(saldo * 100) / 100) })
      }
    } else {
      totalPago = v + v * i * n
      valorParcela = totalPago
      tabela.push({ numero: 1, parcela: Math.round(totalPago * 100) / 100, juros: Math.round((totalPago - v) * 100) / 100, amort: v, saldo: 0 })
    }

    setResult({
      valorParcela: Math.round(valorParcela * 100) / 100,
      totalPago: Math.round(totalPago * 100) / 100,
      totalJuros: Math.round((totalPago - v) * 100) / 100,
      tabela: tabela.slice(0, 60),
    })
  }, [valor, taxa, parcelas, tipo])

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in">
      <div>
        <h1 className="text-2xl font-bold">Calculadora de Empréstimos</h1>
        <p className="text-text-muted text-sm mt-1">Simule empréstimos com diferentes modalidades</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Inputs */}
        <div className="glass-card p-5 space-y-4 lg:col-span-1">
          <h2 className="font-semibold text-sm text-text-muted uppercase tracking-wide">Parâmetros</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Valor (R$)</label>
            <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="input-field" step="100" min="100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Taxa de Juros (% a.m.)</label>
            <input type="number" value={taxa} onChange={(e) => setTaxa(e.target.value)} className="input-field" step="0.1" min="0.1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Parcelas</label>
            <input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="input-field" min="1" max="120" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Modalidade</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as 'PRICE' | 'SIMPLE' | 'BULLET')} className="select-field">
              <option value="PRICE">Tabela Price</option>
              <option value="SIMPLE">Juros Simples</option>
              <option value="BULLET">Bullet (Pagamento Único)</option>
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card stat-card" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
                  <div className="stat-label">Valor da Parcela</div>
                  <div className="stat-value text-accent text-lg">{fmt(result.valorParcela)}</div>
                </div>
                <div className="glass-card stat-card">
                  <div className="stat-label">Total Pago</div>
                  <div className="stat-value text-text-primary text-lg">{fmt(result.totalPago)}</div>
                </div>
                <div className="glass-card stat-card">
                  <div className="stat-label">Total de Juros</div>
                  <div className="stat-value text-yellow-400 text-lg">{fmt(result.totalJuros)}</div>
                </div>
              </div>

              {/* Amortization table */}
              <div className="glass-card p-5">
                <h3 className="font-semibold text-sm mb-3">Tabela de Amortização</h3>
                <div className="overflow-x-auto max-h-96">
                  <table className="data-table">
                    <thead className="sticky top-0" style={{ background: 'var(--color-bg-card)' }}>
                      <tr><th>#</th><th>Parcela</th><th>Juros</th><th>Amortização</th><th>Saldo</th></tr>
                    </thead>
                    <tbody>
                      {result.tabela.map((r) => (
                        <tr key={r.numero}>
                          <td className="font-medium">{r.numero}</td>
                          <td className="font-mono text-sm">{fmt(r.parcela)}</td>
                          <td className="font-mono text-sm text-yellow-400">{fmt(r.juros)}</td>
                          <td className="font-mono text-sm text-green-400">{fmt(r.amort)}</td>
                          <td className="font-mono text-sm">{fmt(r.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card p-12 text-center text-text-muted">
              <span className="text-4xl mb-4 block">🧮</span>
              Preencha os parâmetros para ver a simulação
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
