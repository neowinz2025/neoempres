'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Parcela {
  id: string; numero: number; valor: number; valorOriginal: number; multa: number; jurosAtraso: number
  vencimento: string; status: string; dataPagamento: string | null; valorPago: number | null
}
interface Emprestimo {
  id: string; valor: number; taxaJuros: number; tipo: string; numParcelas: number; valorParcela: number
  saldoDevedor: number; status: string; createdAt: string; parcelas: Parcela[]
}
interface Cliente {
  id: string; nome: string; telefone: string; score: string; token: string; createdAt: string
  notificarWpp: boolean;
  emprestimos: Emprestimo[]
}

const statusBadge: Record<string, string> = {
  PAGO: 'badge-success', PENDENTE: 'badge-warning', ATRASADO: 'badge-danger', PARCIAL: 'badge-info',
  ATIVO: 'badge-accent', QUITADO: 'badge-success', RENEGOCIADO: 'badge-info', INADIMPLENTE: 'badge-danger',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/clientes')
      } else {
        const data = await res.json()
        alert(data.error || 'Erro ao excluir cliente')
      }
    } catch {
      alert('Erro ao excluir cliente')
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  useEffect(() => {
    fetch(`/api/clientes/${id}`)
      .then((r) => r.json())
      .then((j) => { setCliente(j.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!cliente) return <div className="text-center py-12 text-text-muted">Cliente não encontrado</div>

  const totalDevedor = cliente.emprestimos.filter(e => e.status === 'ATIVO').reduce((s, e) => s + e.saldoDevedor, 0)

  return (
    <div className="space-y-5 animate-in">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/admin/clientes" className="hover:text-accent">Clientes</Link>
        <span>→</span>
        <span className="text-text-primary">{cliente.nome}</span>
      </div>

      {/* Client Info */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {cliente.nome.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl font-bold">{cliente.nome}</h1>
              <p className="text-text-secondary text-sm">{cliente.telefone}</p>
              <p className="text-text-muted text-xs mt-1">Desde {fmtDate(cliente.createdAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`badge ${statusBadge[cliente.score] || 'badge-warning'}`}>Score {cliente.score}</span>
            <button
              onClick={async () => {
                const newValue = !cliente.notificarWpp;
                setCliente({ ...cliente, notificarWpp: newValue });
                await fetch(`/api/clientes/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ notificarWpp: newValue })
                });
              }}
              className={`btn-sm flex items-center gap-2`}
              style={{
                background: cliente.notificarWpp ? '#ecfdf5' : '#f1f5f9',
                color: cliente.notificarWpp ? '#10b981' : '#64748b',
                border: `1px solid ${cliente.notificarWpp ? '#a7f3d0' : '#cbd5e1'}`,
                borderRadius: '0.75rem', padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
              }}
            >
              <div className={`w-3 h-3 rounded-full ${cliente.notificarWpp ? 'bg-[#10b981]' : 'bg-[#64748b]'}`}></div>
              WhatsApp: {cliente.notificarWpp ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/cliente/${cliente.token}`)}
              className="btn-secondary btn-sm"
            >
              📋 Copiar Link Portal
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-sm"
              style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: '0.75rem', padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              🗑️ Excluir
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-2">Excluir Cliente</h3>
            <p className="text-text-secondary text-sm mb-4">
              Tem certeza que deseja excluir <strong>{cliente.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            {cliente.emprestimos.length > 0 && (
              <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
                  ⚠️ Este cliente possui {cliente.emprestimos.length} empréstimo(s). Todos serão excluídos.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1" style={{ borderRadius: '0.75rem' }}>
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 font-semibold text-sm py-2.5 rounded-xl transition-colors"
                style={{ background: 'var(--color-danger)', color: 'white', opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card stat-card"><div className="stat-label">Empréstimos</div><div className="stat-value text-accent">{cliente.emprestimos.length}</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Saldo Devedor</div><div className="stat-value text-yellow-400 text-lg">{fmt(totalDevedor)}</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Score</div><div className="stat-value" style={{ color: cliente.score === 'A' ? '#10b981' : cliente.score === 'D' ? '#ef4444' : '#f59e0b' }}>{cliente.score}</div></div>
        <div className="glass-card stat-card"><div className="stat-label">Token</div><div className="stat-value text-sm font-mono text-text-secondary truncate">{cliente.token.slice(0, 12)}...</div></div>
      </div>

      {/* Loans */}
      {cliente.emprestimos.map((emp) => (
        <div key={emp.id} className="glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{fmt(emp.valor)}</h3>
                <span className={`badge ${statusBadge[emp.status]}`}>{emp.status}</span>
                <span className="badge badge-accent">{emp.tipo}</span>
              </div>
              <p className="text-text-muted text-xs mt-1">
                {emp.numParcelas}x de {fmt(emp.valorParcela)} • Taxa {emp.taxaJuros}% a.m. • Criado {fmtDate(emp.createdAt)}
              </p>
            </div>
            <Link href={`/admin/emprestimos/${emp.id}`} className="btn-secondary btn-sm">
              Detalhes →
            </Link>
          </div>

          {/* Installments */}
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="data-table min-w-[600px]">
              <thead>
                <tr><th>#</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Pagamento</th></tr>
              </thead>
              <tbody>
                {emp.parcelas.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.numero}</td>
                    <td className="font-mono text-sm">{fmt(p.valor)}</td>
                    <td>{fmtDate(p.vencimento)}</td>
                    <td><span className={`badge ${statusBadge[p.status]}`}>{p.status}</span></td>
                    <td>{p.dataPagamento ? `${fmtDate(p.dataPagamento)} — ${fmt(p.valorPago || 0)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {cliente.emprestimos.length === 0 && (
        <div className="glass-card p-8 text-center text-text-muted">
          Nenhum empréstimo registrado
          <div className="mt-3">
            <Link href="/admin/emprestimos/novo" className="btn-primary">
              + Criar Empréstimo
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
