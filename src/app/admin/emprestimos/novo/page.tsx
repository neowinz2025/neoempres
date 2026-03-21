'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Cliente {
  id: string; nome: string; telefone: string
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function NovoEmprestimoPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [valor, setValor] = useState('')
  const [taxaJuros, setTaxaJuros] = useState('5')
  const [tipo, setTipo] = useState<'PRICE' | 'SIMPLE' | 'BULLET'>('PRICE')
  const [numParcelas, setNumParcelas] = useState('12')
  const [modoEntrada, setModoEntrada] = useState<'TAXA' | 'PARCELA'>('TAXA')
  const [valorParcelaInput, setValorParcelaInput] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0])
  const [simulacao, setSimulacao] = useState<{valorParcela: number; totalPago: number; totalJuros: number; taxaCalculada: number} | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/clientes?limit=1000').then(r => r.json()).then(j => setClientes(j.data || []))
  }, [])

  // Auto-simulate
  useEffect(() => {
    const v = parseFloat(valor)
    const n = parseInt(numParcelas)
    if (!v || !n || v <= 0) { setSimulacao(null); return }

    if (modoEntrada === 'TAXA') {
      const t = parseFloat(taxaJuros)
      if (!t) { setSimulacao(null); return }
      const i = t / 100
      let valorParcela: number, totalPago: number
      if (tipo === 'PRICE') {
        valorParcela = v * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
        totalPago = valorParcela * n
      } else if (tipo === 'SIMPLE') {
        valorParcela = v / n + v * i
        totalPago = valorParcela * n
      } else {
        totalPago = v + v * i * n
        valorParcela = totalPago
      }
      setSimulacao({
        valorParcela: Math.round(valorParcela * 100) / 100,
        totalPago: Math.round(totalPago * 100) / 100,
        totalJuros: Math.round((totalPago - v) * 100) / 100,
        taxaCalculada: t
      })
    } else {
      const pmt = parseFloat(valorParcelaInput)
      if (!pmt || pmt * n <= v) { setSimulacao(null); return }
      
      let i = 0;
      if (tipo === 'SIMPLE') {
        i = (pmt - v / n) / v;
      } else if (tipo === 'BULLET') {
        i = (pmt - v) / (v * n);
      } else {
        // Price - Bisection Method
        let low = 0.000001;
        let high = 1.0;
        for (let iter = 0; iter < 50; iter++) {
          i = (low + high) / 2;
          let guessPV = pmt * (1 - Math.pow(1 + i, -n)) / i;
          if (guessPV > v) low = i; else high = i;
        }
      }
      
      const t = i * 100;
      setSimulacao({
        valorParcela: Math.round(pmt * 100) / 100,
        totalPago: Math.round(pmt * n * 100) / 100,
        totalJuros: Math.round((pmt * n - v) * 100) / 100,
        taxaCalculada: t
      })
    }
  }, [valor, taxaJuros, tipo, numParcelas, modoEntrada, valorParcelaInput])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simulacao) return
    
    setSaving(true)
    const taxaAEnviar = simulacao.taxaCalculada

    const res = await fetch('/api/emprestimos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId, valor: parseFloat(valor), taxaJuros: parseFloat(taxaAEnviar.toFixed(4)),
        tipo, numParcelas: parseInt(numParcelas), dataInicio,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      router.push(`/admin/emprestimos/${json.data.id}`)
    } else {
      setSaving(false)
      alert('Erro ao criar empréstimo')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in">
      <h1 className="text-2xl font-bold">Novo Empréstimo</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-sm text-text-muted uppercase tracking-wide">Dados do Empréstimo</h2>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="select-field" required>
              <option value="">Selecione um cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Valor do Empréstimo (R$)</label>
              <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="input-field" placeholder="10000" step="0.01" min="100" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Modo de Cálculo</label>
              <select value={modoEntrada} onChange={(e) => setModoEntrada(e.target.value as 'TAXA' | 'PARCELA')} className="select-field">
                <option value="TAXA">Fixar Taxa de Juros</option>
                <option value="PARCELA">Fixar Valor da Parcela</option>
              </select>
            </div>
            {modoEntrada === 'TAXA' ? (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Taxa de Juros (% a.m.)</label>
                <input type="number" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} className="input-field" placeholder="5" step="0.01" min="0.1" required />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Valor da Parcela (R$)</label>
                <input type="number" value={valorParcelaInput} onChange={(e) => setValorParcelaInput(e.target.value)} className="input-field" placeholder="0.00" step="0.01" min="0.1" required />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as 'PRICE' | 'SIMPLE' | 'BULLET')} className="select-field">
                <option value="PRICE">Tabela Price</option>
                <option value="SIMPLE">Juros Simples</option>
                <option value="BULLET">Bullet (Único)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Parcelas</label>
              <input type="number" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} className="input-field" placeholder="12" min="1" max="120" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Data de Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="input-field" required />
          </div>
        </div>

        {/* Simulation Preview */}
        {simulacao && (
          <div className="glass-card p-5 space-y-3" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
            <h2 className="font-semibold text-sm text-accent uppercase tracking-wide">📊 Simulação</h2>
            <div className="grid grid-cols-4 gap-4">
              <div><div className="text-xs text-text-muted mb-1">Valor da Parcela</div><div className="text-sm font-bold text-accent">{fmt(simulacao.valorParcela)}</div></div>
              <div><div className="text-xs text-text-muted mb-1">Total Pago</div><div className="text-sm font-bold text-text-primary">{fmt(simulacao.totalPago)}</div></div>
              <div><div className="text-xs text-text-muted mb-1">Total de Juros</div><div className="text-sm font-bold text-yellow-400">{fmt(simulacao.totalJuros)}</div></div>
              <div><div className="text-xs text-text-muted mb-1">Taxa Implícita</div><div className="text-sm font-bold text-info">{simulacao.taxaCalculada.toFixed(2)}% a.m.</div></div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1 justify-center">Cancelar</button>
          <button type="submit" disabled={saving || !simulacao} className="btn-primary flex-1 justify-center disabled:opacity-50">
            {saving ? 'Criando...' : 'Criar Empréstimo'}
          </button>
        </div>
      </form>
    </div>
  )
}
