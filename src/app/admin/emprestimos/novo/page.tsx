'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { calcSimulacao } from '@/lib/calculations'

interface Cliente {
  id: string; nome: string; telefone: string
}
interface Produto {
  id: string; nome: string; descricao: string | null; valorBase: number | null
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function NovoEmprestimoPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [clienteId, setClienteId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [valor, setValor] = useState('')
  const [taxaJuros, setTaxaJuros] = useState('5')
  const [tipo, setTipo] = useState<'PRICE' | 'SIMPLE' | 'BULLET'>('PRICE')
  const [numParcelas, setNumParcelas] = useState('12')
  
  // Quando mudar para Bullet, força 1 parcela
  useEffect(() => {
    if (tipo === 'BULLET') setNumParcelas('1')
    else if (numParcelas === '1') setNumParcelas('12')
  }, [tipo])
  const [frequencia, setFrequencia] = useState<'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL'>('MENSAL')
  const [multa, setMulta] = useState('2.0')
  const [juros, setJuros] = useState('0.033')
  const [modoEntrada, setModoEntrada] = useState<'TAXA' | 'PARCELA'>('TAXA')
  const [valorParcelaInput, setValorParcelaInput] = useState('')
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0])
  const [simulacao, setSimulacao] = useState<{valorParcela: number; totalPago: number; totalJuros: number; taxaCalculada: number} | null>(null)
  const [parcelasEditaveis, setParcelasEditaveis] = useState<{numero: number, valor: number, vencimento: string}[]>([])
  const [taxaCalculadaBase, setTaxaCalculadaBase] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // Modal para criar produto
  const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false)
  const [novoProdutoNome, setNovoProdutoNome] = useState('')
  const [novoProdutoDesc, setNovoProdutoDesc] = useState('')
  const [novoProdutoValor, setNovoProdutoValor] = useState('')
  const [savingProduto, setSavingProduto] = useState(false)

  const taxaLabel = frequencia === 'MENSAL' ? 'a.m.' : frequencia === 'SEMANAL' ? 'a.s.' : frequencia === 'QUINZENAL' ? 'a.q.' : 'a.d.'

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  useEffect(() => {
    fetch('/api/clientes?limit=1000').then(r => r.json()).then(j => setClientes(j.data || []))
    fetch('/api/produtos?ativo=true').then(r => r.json()).then(j => setProdutos(j.data || []))
  }, [])

  const handleProdutoChange = (id: string) => {
    setProdutoId(id)
    if (id) {
      const p = produtos.find(x => x.id === id)
      if (p && p.valorBase) setValor(p.valorBase.toString())
    }
  }

  const handleCreateProduto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoProdutoNome) return
    setSavingProduto(true)
    const res = await fetch('/api/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: novoProdutoNome,
        descricao: novoProdutoDesc || undefined,
        valorBase: novoProdutoValor ? parseFloat(novoProdutoValor) : undefined,
      }),
    })
    setSavingProduto(false)
    if (res.ok) {
      const json = await res.json()
      setProdutos(prev => [...prev, json.data])
      handleProdutoChange(json.data.id)
      setIsProdutoModalOpen(false)
      setNovoProdutoNome('')
      setNovoProdutoDesc('')
      setNovoProdutoValor('')
      showToast('Produto criado com sucesso!')
    } else {
      showToast('Erro ao criar produto')
    }
  }

  // Auto-simulate base
  useEffect(() => {
    const v = parseFloat(valor)
    const n = parseInt(numParcelas)
    if (!v || !n || v <= 0) { setParcelasEditaveis([]); setTaxaCalculadaBase(0); return }

    let t = 0
    if (modoEntrada === 'TAXA') {
      t = parseFloat(taxaJuros)
      if (!t) { setParcelasEditaveis([]); setTaxaCalculadaBase(0); return }
    } else {
      const pmt = parseFloat(valorParcelaInput)
      if (!pmt) { setParcelasEditaveis([]); setTaxaCalculadaBase(0); return }
      if (tipo === 'BULLET' && pmt < v) { setParcelasEditaveis([]); setTaxaCalculadaBase(0); return }
      if (tipo !== 'BULLET' && pmt * n < v) { setParcelasEditaveis([]); setTaxaCalculadaBase(0); return }
      
      let i = 0;
      if (tipo === 'SIMPLE') {
        i = (pmt - v / n) / v;
      } else if (tipo === 'BULLET') {
        i = pmt / v;
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
      t = i * 100;
    }

    setTaxaCalculadaBase(t)
    const inicio = dataInicio ? new Date(dataInicio) : new Date()
    if (dataInicio && inicio.getTime() === new Date(`${dataInicio}T00:00:00`).getTime()) {
      // ajusta para nao ficar dia anterior por timezone
      inicio.setUTCHours(12, 0, 0, 0)
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const result = calcSimulacao(tipo, v, t, n, inicio, frequencia)
    setParcelasEditaveis(result.parcelas.map((p: any) => ({
      numero: p.numero,
      valor: p.valor,
      vencimento: p.vencimento.toISOString().split('T')[0]
    })))
  }, [valor, taxaJuros, tipo, numParcelas, modoEntrada, valorParcelaInput, frequencia, dataInicio])

  // Derive simulacao from parcelasEditaveis
  useEffect(() => {
    if (!parcelasEditaveis.length) {
      setSimulacao(null)
      return
    }
    const v = parseFloat(valor)
    const totalPago = parcelasEditaveis.reduce((acc, p) => acc + p.valor, 0)
    const totalJuros = totalPago - (v || 0)
    setSimulacao({
      valorParcela: parcelasEditaveis[0]?.valor || 0,
      totalPago: Math.round(totalPago * 100) / 100,
      totalJuros: Math.max(0, Math.round(totalJuros * 100) / 100),
      taxaCalculada: taxaCalculadaBase
    })
  }, [parcelasEditaveis, valor, taxaCalculadaBase])

  const handleUpdateParcela = (index: number, field: 'valor' | 'vencimento', val: string) => {
    const updated = [...parcelasEditaveis]
    if (field === 'valor') {
      updated[index].valor = parseFloat(val) || 0
    } else {
      updated[index].vencimento = val
    }
    setParcelasEditaveis(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!simulacao) return
    
    setSaving(true)
    const taxaAEnviar = simulacao.taxaCalculada

    const res = await fetch('/api/emprestimos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId, produtoId: produtoId || undefined, valor: parseFloat(valor), taxaJuros: parseFloat(taxaAEnviar.toFixed(4)),
        tipo, numParcelas: parseInt(numParcelas), dataInicio, frequencia,
        multaPercent: parseFloat(multa), jurosDiario: parseFloat(juros),
        parcelasCustomizadas: parcelasEditaveis
      }),
    })
    if (res.ok) {
      const json = await res.json()
      router.push(`/admin/emprestimos/${json.data.id}`)
    } else {
      setSaving(false)
      showToast('Erro ao criar empréstimo')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in relative">
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[9999] px-4 py-4 md:py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-5 border text-white text-sm font-medium text-center bg-red-900/95 border-red-500">
          {toastMsg}
        </div>
      )}

      <h1 className="text-2xl font-bold">Novo Empréstimo</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-sm text-text-muted uppercase tracking-wide">Dados do Empréstimo</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Cliente</label>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="select-field" required>
                <option value="">Selecione um cliente</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.telefone}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Produto Financiado (Opcional)</label>
              <div className="flex gap-2">
                <select value={produtoId} onChange={(e) => handleProdutoChange(e.target.value)} className="select-field flex-1">
                  <option value="">Nenhum produto</option>
                  {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                <button type="button" onClick={() => setIsProdutoModalOpen(true)} className="btn-secondary px-3" title="Cadastrar Novo Produto">
                  + Novo
                </button>
              </div>
            </div>
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
                <label className="block text-sm font-medium text-text-secondary mb-1">Taxa de Juros (% {taxaLabel})</label>
                <input type="number" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)} className="input-field" placeholder="5" step="0.01" min="0.1" required />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  {tipo === 'BULLET' ? 'Valor dos Juros (R$)' : 'Valor da Parcela (R$)'}
                </label>
                <input type="number" value={valorParcelaInput} onChange={(e) => setValorParcelaInput(e.target.value)} className="input-field" placeholder="0.00" step="0.01" min="0.1" required />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as 'PRICE' | 'SIMPLE' | 'BULLET')} className="select-field">
                <option value="PRICE">Parcelas Fixas (Amortizável)</option>
                <option value="SIMPLE">Juros Simples</option>
                <option value="BULLET">Pagar Só Juros (Renovável)</option>
              </select>
            </div>
            {tipo !== 'BULLET' ? (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Parcelas</label>
                <input type="number" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} className="input-field" placeholder="12" min="1" max="360" required />
              </div>
            ) : (
              <div className="flex flex-col justify-end">
                <div className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-3 py-2 rounded-lg border border-emerald-500/20">
                   🔄 Renovação Dinâmica Ativada
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Frequência</label>
              <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL')} className="select-field">
                <option value="MENSAL">Mensal</option>
                <option value="QUINZENAL">Quinzenal</option>
                <option value="SEMANAL">Semanal</option>
                <option value="DIARIO">Diário</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Data de Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Multa Atraso (%)</label>
              <input type="number" value={multa} onChange={(e) => setMulta(e.target.value)} className="input-field" step="0.01" min="0" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Juros Atraso (% a.d.)</label>
              <input type="number" value={juros} onChange={(e) => setJuros(e.target.value)} className="input-field" step="0.001" min="0" required />
            </div>
          </div>
        </div>

        {/* Simulation Preview */}
        {simulacao && (
          <div className="glass-card p-5 space-y-4" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
            <h2 className="font-semibold text-sm text-accent uppercase tracking-wide">📊 Parcelas e Simulação</h2>
            <div className="grid grid-cols-4 gap-4 pb-4 border-b border-white/5">
              <div><div className="text-xs text-text-muted mb-1">1ª Parcela</div><div className="text-sm font-bold text-accent">{fmt(simulacao.valorParcela)}</div></div>
              <div><div className="text-xs text-text-muted mb-1">Total Recebido</div><div className="text-sm font-bold text-text-primary">{fmt(simulacao.totalPago)}</div></div>
              <div><div className="text-xs text-text-muted mb-1">Total de Juros</div><div className="text-sm font-bold text-yellow-400">{fmt(simulacao.totalJuros)}</div></div>
              <div><div className="text-xs text-text-muted mb-1">Taxa Implícita Base</div><div className="text-sm font-bold text-info">{simulacao.taxaCalculada.toFixed(2)}% {taxaLabel}</div></div>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              <div className="text-xs text-text-muted mb-2">Edite os valores ou datas abaixo para personalizar o fluxo:</div>
              {parcelasEditaveis.map((p, idx) => (
                <div key={idx} className="flex gap-3 items-center bg-white/5 p-2 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                  <div className="w-8 text-center text-xs font-bold text-text-muted">#{p.numero}</div>
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Valor Esperado</label>
                    <input 
                      type="number" 
                      value={p.valor || ''} 
                      onChange={(e) => handleUpdateParcela(idx, 'valor', e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono"
                      step="0.01" min="0" required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Vencimento</label>
                    <input 
                      type="date" 
                      value={p.vencimento} 
                      onChange={(e) => handleUpdateParcela(idx, 'vencimento', e.target.value)}
                      className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                      required
                    />
                  </div>
                </div>
              ))}
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

      {/* Modal Criar Produto */}
      {isProdutoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1e1e2e] rounded-xl w-full max-w-md p-6 border border-white/10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold mb-4">Cadastrar Produto</h3>
            <form onSubmit={handleCreateProduto} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Produto</label>
                <input type="text" value={novoProdutoNome} onChange={e => setNovoProdutoNome(e.target.value)} className="input-field" required placeholder="Ex: Moto Honda CG 160" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Valor Base (R$)</label>
                <input type="number" step="0.01" value={novoProdutoValor} onChange={e => setNovoProdutoValor(e.target.value)} className="input-field" placeholder="Ex: 15000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Descrição / Detalhes</label>
                <textarea value={novoProdutoDesc} onChange={e => setNovoProdutoDesc(e.target.value)} className="input-field min-h-[80px]" placeholder="Ano, Marca, Chassi, etc." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsProdutoModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" disabled={savingProduto} className="btn-primary flex-1 justify-center">
                  {savingProduto ? 'Salvando...' : 'Salvar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
