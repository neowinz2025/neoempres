'use client'

import { useState, useEffect, use, useCallback } from 'react'
import Link from 'next/link'

interface Parcela {
  id: string; numero: number; valor: number; valorOriginal: number; multa: number; jurosAtraso: number
  vencimento: string; status: string; pixTxId: string | null; dataPagamento: string | null; valorPago: number | null
}
interface Emprestimo {
  id: string; valor: number; taxaJuros: number; tipo: string; numParcelas: number; valorParcela: number
  saldoDevedor: number; multaPercent: number; jurosDiario: number; status: string; token: string; createdAt: string
  cliente: { id: string; nome: string; telefone: string; score: string; token: string }
  parcelas: Parcela[]
}

const statusBadge: Record<string, string> = {
  PAGO: 'badge-success', PENDENTE: 'badge-warning', ATRASADO: 'badge-danger', PARCIAL: 'badge-info',
  ATIVO: 'badge-accent', QUITADO: 'badge-success', RENEGOCIADO: 'badge-info', INADIMPLENTE: 'badge-danger',
}

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }

export default function EmprestimoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [emp, setEmp] = useState<Emprestimo | null>(null)
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/emprestimos/${id}`)
    const json = await res.json()
    setEmp(json.data)
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const markPaid = async (parcelaId: string) => {
    setPayingId(parcelaId)
    await fetch(`/api/parcelas/${parcelaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAGO' }),
    })
    await fetchData()
    setPayingId(null)
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!emp) return <div className="text-center py-12 text-text-muted">Empréstimo não encontrado</div>

  const pagas = emp.parcelas.filter(p => p.status === 'PAGO').length
  const atrasadas = emp.parcelas.filter(p => p.status === 'ATRASADO').length
  const progresso = emp.parcelas.length > 0 ? Math.round((pagas / emp.parcelas.length) * 100) : 0

  return (
    <div className="space-y-5 animate-in">
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
              <span className="badge badge-accent">{emp.tipo}</span>
            </div>
            <p className="text-text-secondary text-sm">
              Cliente: <Link href={`/admin/clientes/${emp.cliente.id}`} className="text-accent hover:underline">{emp.cliente.nome}</Link>
            </p>
            <p className="text-text-muted text-xs mt-1">
              {emp.numParcelas}x de {fmt(emp.valorParcela)} • Taxa {emp.taxaJuros}% a.m. • Multa {emp.multaPercent}% • Juros dia {emp.jurosDiario}%
            </p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/cliente/${emp.cliente.token}`)}
            className="btn-secondary btn-sm"
          >
            📋 Link Portal
          </button>
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
                  <td className="text-sm">{p.dataPagamento ? `${fmtDate(p.dataPagamento)} — ${fmt(p.valorPago || 0)}` : '—'}</td>
                  <td>
                    {p.status !== 'PAGO' && (
                      <button
                        onClick={() => markPaid(p.id)}
                        disabled={payingId === p.id}
                        className="btn-sm text-xs"
                        style={{ background: 'var(--color-success-light)', color: 'var(--color-success)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '4px 12px', fontWeight: 600 }}
                      >
                        {payingId === p.id ? '...' : '✓ Marcar Pago'}
                      </button>
                    )}
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
              {p.status !== 'PAGO' && (
                <button onClick={() => markPaid(p.id)} disabled={payingId === p.id} className="btn-sm btn-primary text-xs">
                  {payingId === p.id ? '...' : '✓'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
