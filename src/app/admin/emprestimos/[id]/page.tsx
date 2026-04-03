'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'

interface Parcela {
  id: string; numero: number; valor: number; valorOriginal: number; multa: number; jurosAtraso: number
  vencimento: string; status: string; pixTxId: string | null; dataPagamento: string | null; valorPago: number | null
  formaPagamento: string | null; comprovante: string | null
}
interface Emprestimo {
  id: string; valor: number; taxaJuros: number; tipo: string; numParcelas: number; valorParcela: number
  frequencia: 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL'; saldoDevedor: number; multaPercent: number; jurosDiario: number; status: string; token: string; createdAt: string
  cliente: { id: string; nome: string; telefone: string; score: string; token: string }
  produto?: { id: string; nome: string; descricao: string | null; valorBase: number | null } | null
  parcelas: Parcela[]
}

const statusBadge: Record<string, string> = {
  PAGO: 'badge-success', PENDENTE: 'badge-warning', ATRASADO: 'badge-danger', PARCIAL: 'badge-info',
  ATIVO: 'badge-accent', QUITADO: 'badge-success', RENEGOCIADO: 'badge-info', INADIMPLENTE: 'badge-danger',
}
const tipoLabel: Record<string, string> = { 
  PRICE: 'Parcelas Fixas (Amortizável)', 
  SIMPLE: 'Juros Simples', 
  BULLET: 'Pagar Só Juros'
}

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }

export default function EmprestimoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [emp, setEmp] = useState<Emprestimo | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  // Modal States
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; parcelaId: string; valorTotal: number; jaPago: number }>({ isOpen: false, parcelaId: '', valorTotal: 0, jaPago: 0 })
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('PIX')
  const [receiptBase64, setReceiptBase64] = useState<string>('')
  
  const [editModal, setEditModal] = useState<{ isOpen: boolean; parcela: Parcela | null }>({ isOpen: false, parcela: null })
  const [editVencimento, setEditVencimento] = useState('')
  const [editValor, setEditValor] = useState('')

  const [rnModal, setRnModal] = useState(false)
  const [rnSaving, setRnSaving] = useState(false)
  const [rnValor, setRnValor] = useState('')
  const [rnTaxa, setRnTaxa] = useState('')
  const [rnTipo, setRnTipo] = useState<'PRICE'|'SIMPLE'|'BULLET'>('PRICE')
  const [rnFreq, setRnFreq] = useState<'DIARIO'|'SEMANAL'|'QUINZENAL'|'MENSAL'>('MENSAL')
  const [rnParcelas, setRnParcelas] = useState('12')
  const [rnInicio, setRnInicio] = useState('')

  const [comprovanteModal, setComprovanteModal] = useState<{ isOpen: boolean; src: string; isPdf: boolean }>({ isOpen: false, src: '', isPdf: false })

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  /** Open base64 comprovante safely — converts to Blob URL to bypass browser base64 navigation block */
  const openComprovante = (base64: string) => {
    try {
      const isPdf = base64.startsWith('data:application/pdf')
      // Try to open in a new tab via blob first
      const [header, data] = base64.split(',')
      const mime = header.match(/:(.*?);/)?.[1] || (isPdf ? 'application/pdf' : 'image/jpeg')
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: mime })
      const url = URL.createObjectURL(blob)

      if (isPdf) {
        window.open(url, '_blank')
        // Clean up after 60s
        setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        // Images: show inside modal for better UX
        setComprovanteModal({ isOpen: true, src: url, isPdf: false })
      }
    } catch {
      // Fallback: show modal with raw base64 as img src
      setComprovanteModal({ isOpen: true, src: base64, isPdf: false })
    }
  }

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/emprestimos/${id}`)
    const json = await res.json()
    setEmp(json.data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await fetch(`/api/emprestimos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/admin/emprestimos')
    } else {
      setIsDeleting(false)
      showToast('Erro ao excluir empréstimo.')
    }
  }

  const openRenegociar = () => {
    if (!emp) return
    setRnValor(emp.saldoDevedor.toString())
    setRnTaxa(emp.taxaJuros.toString())
    setRnTipo(emp.tipo as any)
    setRnFreq(emp.frequencia)
    setRnParcelas(emp.numParcelas.toString())
    setRnInicio(new Date().toISOString().split('T')[0])
    setRnModal(true)
  }

  const submitRenegociar = async (e: React.FormEvent) => {
    e.preventDefault()
    setRnSaving(true)
    const res = await fetch(`/api/emprestimos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        renegociar: true,
        valor: parseFloat(rnValor),
        taxaJuros: parseFloat(rnTaxa),
        tipo: rnTipo,
        numParcelas: parseInt(rnParcelas),
        frequencia: rnFreq,
        dataInicio: rnInicio
      })
    })
    setRnSaving(false)
    if (res.ok) {
      setRnModal(false)
      fetchData()
      showToast('Empréstimo renegociado!')
    } else {
      showToast('Erro ao renegociar.')
    }
  }

  const handleOpenPayment = (p: Parcela) => {
    const defaultAmount = (p.valor - (p.valorPago || 0)).toFixed(2)
    setPayAmount(defaultAmount)
    setPayMethod('PIX')
    setReceiptBase64('')
    setPaymentModal({ isOpen: true, parcelaId: p.id, valorTotal: p.valor, jaPago: p.valorPago || 0 })
  }

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    const paymentNow = parseFloat(payAmount.replace(',', '.'))
    if (isNaN(paymentNow) || paymentNow <= 0) return showToast('Valor inválido!')

    const p = paymentModal
    const novoValorTotalPago = p.jaPago + paymentNow
    const isPartial = novoValorTotalPago < p.valorTotal
    const status = isPartial ? 'PARCIAL' : 'PAGO'

    setPayingId(p.parcelaId)
    setPaymentModal({ ...paymentModal, isOpen: false })
    
    await fetch(`/api/parcelas/${p.parcelaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status, 
        valorPago: novoValorTotalPago,
        formaPagamento: payMethod,
        comprovante: receiptBase64 || undefined
      }),
    })
    
    await fetchData()
    setPayingId(null)
    showToast('Pagamento registrado!')
  }

  const openEdit = (p: Parcela) => {
    setEditVencimento(p.vencimento.split('T')[0])
    setEditValor(p.valorOriginal.toString())
    setEditModal({ isOpen: true, parcela: p })
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModal.parcela) return
    
    const original = parseFloat(editValor)
    if (isNaN(original) || original <= 0) return showToast('Valor inválido')

    setPayingId(editModal.parcela.id)
    setEditModal({ isOpen: false, parcela: null })

    await fetch(`/api/parcelas/${editModal.parcela.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valorOriginal: original,
        vencimento: editVencimento
      })
    })

    await fetchData()
    setPayingId(null)
    showToast('Parcela atualizada!')
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('Arquivo muito grande! Máx 2MB.')
    
    const reader = new FileReader()
    reader.onload = (ev) => {
      setReceiptBase64(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!emp) return <div className="text-center py-12 text-text-muted">Empréstimo não encontrado</div>

  const pagas = emp.parcelas.filter(p => p.status === 'PAGO').length
  const atrasadas = emp.parcelas.filter(p => p.status === 'ATRASADO').length
  const progresso = emp.parcelas.length > 0 ? Math.round((pagas / emp.parcelas.length) * 100) : 0

  return (
    <div className="space-y-5 animate-in relative">
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[9999] px-4 py-4 md:py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-5 border text-white text-sm font-medium text-center bg-[#1a1b26] border-accent">
          {toastMsg}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/admin/emprestimos" className="hover:text-accent">Empréstimos</Link>
        <span>→</span>
        <span className="text-text-primary">{emp.cliente.nome}</span>
      </div>

      {/* Info */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h1 className="text-xl font-bold">{fmt(emp.valor)}</h1>
              <span className={`badge ${statusBadge[emp.status]}`}>{emp.status}</span>
              <span className="badge badge-accent">{tipoLabel[emp.tipo] || emp.tipo}</span>
            </div>
            <p className="text-text-secondary text-sm">
              Cliente: <Link href={`/admin/clientes/${emp.cliente.id}`} className="text-accent hover:underline">{emp.cliente.nome}</Link>
            </p>
            {emp.produto && (
              <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1 font-semibold flex items-center gap-2">
                  📦 Produto Financiado
                </div>
                <div className="font-medium text-white">{emp.produto.nome} {emp.produto.valorBase ? ` — ${fmt(emp.produto.valorBase)}` : ''}</div>
                {emp.produto.descricao && (
                  <div className="text-sm text-text-secondary mt-1.5 whitespace-pre-wrap">{emp.produto.descricao}</div>
                )}
              </div>
            )}
            <p className="text-text-muted text-xs mt-1">
              {emp.numParcelas}x de {fmt(emp.valorParcela)} ({emp.frequencia}) • Taxa {emp.taxaJuros}% {emp.frequencia === 'MENSAL' ? 'a.m.' : emp.frequencia === 'SEMANAL' ? 'a.s.' : emp.frequencia === 'QUINZENAL' ? 'a.q.' : 'a.d.'} • Multa {emp.multaPercent}% • Juros dia {emp.jurosDiario}%
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={openRenegociar}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-center"
              title="Recriar cronograma de parcelas não-pagas usando saldo restante"
            >
              🤝 Renegociar
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/cliente/${emp.cliente.token}`).then(()=>showToast('Link copiado!'))}
              className="btn-secondary btn-sm"
            >
              📋 Link Portal
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
            >
              🗑️ Excluir
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="glass-card stat-card"><div className="stat-label">Saldo Devedor</div><div className="stat-value text-yellow-400 text-lg">{fmt(emp.saldoDevedor)}</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Pagas</div><div className="stat-value text-green-400">{pagas}/{emp.parcelas.length}</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Atrasadas</div><div className="stat-value text-red-400">{atrasadas}</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Progresso</div><div className="stat-value text-accent">{progresso}%</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Criado</div><div className="stat-value text-sm text-text-secondary">{fmtDate(emp.createdAt)}</div></div>
      </div>

      {/* Progress Bar */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between text-xs text-text-muted mb-2">
          <span>Progresso de pagamento</span>
          <span>{progresso}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: 'var(--color-bg-input)' }}>
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progresso}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)' }} />
        </div>
      </div>

      {/* Installments */}
      <div className="glass-card p-5">
        <h2 className="font-semibold mb-4">Parcelas</h2>

        {/* Desktop */}
        <div className="overflow-x-auto hidden md:block">
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Pagamento</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {emp.parcelas.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.numero}</td>
                  <td className="font-mono text-sm">
                    {fmt(p.valor)}
                    {p.multa > 0 && <span className="text-xs text-red-400 ml-1">(+{fmt(p.multa + p.jurosAtraso)})</span>}
                  </td>
                  <td>{fmtDate(p.vencimento)}</td>
                  <td><span className={`badge ${statusBadge[p.status]}`}>{p.status}</span></td>
                  <td className="text-sm">
                    {p.dataPagamento ? (
                      <div className="flex flex-col">
                        <span>{fmtDate(p.dataPagamento)} — {fmt(p.valorPago || 0)}</span>
                        {p.formaPagamento && <span className="text-xs text-text-muted">via {p.formaPagamento}</span>}
                        {p.comprovante && (
                          <button
                            onClick={() => openComprovante(p.comprovante!)}
                            className="text-xs text-accent hover:underline mt-0.5 text-left"
                          >
                            📎 Ver Comprovante
                          </button>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {p.status !== 'PAGO' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenPayment(p)}
                            disabled={payingId === p.id}
                            className="btn-sm text-[11px]"
                            style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 10px', fontWeight: 600 }}
                          >
                            {payingId === p.id ? '...' : p.status === 'PARCIAL' ? '✓ Completar' : '✓ Pgto'}
                          </button>
                          {emp.tipo === 'BULLET' && (
                            <button
                              onClick={() => {
                                const interest = emp.valor * (emp.jurosDiario / 100)
                                const defaultAmount = interest.toFixed(2)
                                setPayAmount(defaultAmount)
                                setPayMethod('PIX')
                                setReceiptBase64('')
                                setPaymentModal({ isOpen: true, parcelaId: p.id, valorTotal: p.valor, jaPago: p.valorPago || 0 })
                              }}
                              className="btn-sm text-[11px] bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 px-2 py-1 rounded-lg font-bold"
                            >
                              % Juros
                            </button>
                          )}
                        </div>
                      )}
                      {(p.status === 'PAGO' || p.status === 'PARCIAL') && (
                        <button
                          onClick={() => window.open(`/comprovante/${p.id}${emp.cliente.token ? `?token=${emp.cliente.token}` : ''}`, '_blank')}
                          className="btn-sm transition-colors text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 px-3 py-1 rounded-lg font-bold"
                          title="Ver Recibo"
                        >
                          🧾 Recibo
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(p)}
                        className="btn-sm transition-colors text-xs bg-white/5 hover:bg-white/10 text-text-primary px-3 py-1 rounded-lg"
                      >
                        ⚙️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile */}
        <div className="md:hidden space-y-2">
          {emp.parcelas.map((p) => (
            <div key={p.id} className="p-3 rounded-xl flex items-center justify-between" style={{ background: 'var(--color-bg-input)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">#{p.numero}</span>
                  <span className={`badge ${statusBadge[p.status]}`}>{p.status}</span>
                </div>
                <div className="text-sm font-mono mt-1">{fmt(p.valor)}</div>
                <div className="text-xs text-text-muted">{fmtDate(p.vencimento)}</div>
              </div>
              <div className="flex gap-2">
                {p.status !== 'PAGO' && (
                  <button onClick={() => handleOpenPayment(p)} disabled={payingId === p.id} className="btn-sm btn-primary text-xs">
                    {payingId === p.id ? '...' : '✓'}
                  </button>
                )}
                <button onClick={() => openEdit(p)} className="btn-sm bg-white/5 text-xs">
                  ⚙️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODALS */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Excluir Empréstimo">
        <p className="text-sm text-text-secondary mb-6">Tem certeza absoluta? Esta ação deletará o empréstimo e **todas** as parcelas associadas. Isso afeta o fluxo de caixa histórico e não pode ser desfeito.</p>
        <div className="flex gap-3">
          <button onClick={() => setIsDeleteOpen(false)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDelete} disabled={isDeleting} className="btn-primary flex-1 bg-red-600 hover:bg-red-700 text-white border-none shadow-red-900/50">
            {isDeleting ? 'Excluindo...' : 'Sim, Excluir Tudo'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={paymentModal.isOpen} onClose={() => setPaymentModal({ ...paymentModal, isOpen: false })} title="Registrar Pagamento">
        <form onSubmit={submitPayment} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Valor Pago (R$)</label>
            <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" required />
            <p className="text-xs text-text-muted mt-1">Saldo restante: {fmt(paymentModal.valorTotal - paymentModal.jaPago)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Forma de Pagamento</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="select-field">
              <option value="PIX">PIX</option>
              <option value="DINHEIRO">Dinheiro Espécie</option>
              <option value="CARTAO">Cartão</option>
              <option value="TRANSFERENCIA">Transferência Bancária</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Comprovante (Imagem/PDF)</label>
            <input type="file" accept="image/*,application/pdf" onChange={handleFile} className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white/5 file:text-white hover:file:bg-white/10 cursor-pointer" />
            {receiptBase64 && <div className="mt-2 text-xs text-green-400">✓ Arquivo carregado na memória</div>}
          </div>
          <button type="submit" className="btn-primary w-full mt-4 justify-center">Confirmar Pagamento</button>
        </form>
      </Modal>

      <Modal isOpen={editModal.isOpen} onClose={() => setEditModal({ isOpen: false, parcela: null })} title="Editar Parcela">
        <form onSubmit={submitEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Vencimento Original</label>
            <input type="date" value={editVencimento} onChange={e => setEditVencimento(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Valor Original (Base da parcela)</label>
            <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} className="input-field" required />
          </div>
          <p className="text-xs text-red-400 mt-2 bg-red-400/10 p-2 rounded">Atenção: Modificar estes valores afeta relatórios retroativamente e altera o cálculo automático atual de juros de atraso.</p>
          <button type="submit" className="btn-primary w-full mt-4 justify-center">Salvar Ajustes</button>
        </form>
      </Modal>

      <Modal isOpen={rnModal} onClose={() => setRnModal(false)} title="Renegociar Empréstimo">
        <form onSubmit={submitRenegociar} className="space-y-4">
          <p className="text-sm text-text-secondary mb-4 bg-white/5 p-3 rounded-lg border border-yellow-500/30 text-yellow-100">
            Esta ação <strong>apagará</strong> permanentemente as parcelas pendentes atuais e recriará um cronograma completamente novo a partir das informações informadas abaixo.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">Novo Saldo (R$)</label>
              <input type="number" step="0.01" value={rnValor} onChange={e => setRnValor(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">Nova Taxa (%)</label>
              <input type="number" step="0.01" value={rnTaxa} onChange={e => setRnTaxa(e.target.value)} className="input-field" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">Tipo do Empréstimo</label>
              <select value={rnTipo} onChange={e => setRnTipo(e.target.value as any)} className="select-field">
                <option value="PRICE">Price (Fixa)</option>
                <option value="SIMPLE">Juros Simples</option>
                <option value="BULLET">Pagar só Juros (Bullet)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">Nova Frequência</label>
              <select value={rnFreq} onChange={e => setRnFreq(e.target.value as any)} className="select-field">
                <option value="MENSAL">Mensal</option>
                <option value="QUINZENAL">Quinzenal</option>
                <option value="SEMANAL">Semanal</option>
                <option value="DIARIO">Diário</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">Qtd Total Parcelas</label>
              <input type="number" value={rnParcelas} onChange={e => setRnParcelas(e.target.value)} className="input-field" required min="1" max="150" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">Data da 1ª Parcela</label>
              <input type="date" value={rnInicio} onChange={e => setRnInicio(e.target.value)} className="input-field" required />
            </div>
          </div>
          <button type="submit" disabled={rnSaving} className="btn-primary w-full mt-4 justify-center">
            {rnSaving ? 'Gerando Novo Cronograma...' : 'Confirmar e Subjetar'}
          </button>
        </form>
      </Modal>

      {/* Modal Comprovante Anexado */}
      {comprovanteModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            URL.revokeObjectURL(comprovanteModal.src)
            setComprovanteModal({ isOpen: false, src: '', isPdf: false })
          }}
        >
          <div
            className="relative max-w-2xl w-full max-h-[90vh] flex flex-col bg-[#1e1e2e] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="font-semibold text-sm">📎 Comprovante Anexado</span>
              <div className="flex gap-2">
                <a
                  href={comprovanteModal.src}
                  download="comprovante"
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors font-semibold"
                >
                  ⬇️ Baixar
                </a>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(comprovanteModal.src)
                    setComprovanteModal({ isOpen: false, src: '', isPdf: false })
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  ✕ Fechar
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={comprovanteModal.src}
                alt="Comprovante de pagamento"
                className="max-w-full max-h-[70vh] rounded-lg object-contain shadow-xl"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
