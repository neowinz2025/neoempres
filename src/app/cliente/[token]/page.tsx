'use client'

import { useState, useEffect, use, useCallback } from 'react'

interface Parcela {
  id: string; numero: number; valor: number; vencimento: string; status: string
  dataPagamento: string | null; valorPago: number | null
}
interface Emprestimo {
  id: string; valor: number; tipo: string; status: string; saldoDevedor: number
  parcelas: Parcela[]
}
interface ClienteData {
  nome: string; saldoDevedor: number
  proximaParcela: Parcela | null
  emprestimos: Emprestimo[]
  historico: Parcela[]
}

const statusBadge: Record<string, string> = {
  PAGO: 'badge-success', PENDENTE: 'badge-warning', ATRASADO: 'badge-danger', PARCIAL: 'badge-info',
  ATIVO: 'badge-accent', QUITADO: 'badge-success',
}

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }

export default function ClientePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<ClienteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pixModal, setPixModal] = useState<{ qrCode: string | null; qrCodeText: string; valor: number } | null>(null)
  const [generatingPix, setGeneratingPix] = useState<string | null>(null)
  const [tab, setTab] = useState<'parcelas' | 'historico'>('parcelas')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cliente/${token}`)
      if (!res.ok) { setError(true); setLoading(false); return }
      const json = await res.json()
      setData(json.data)
    } catch { setError(true) }
    setLoading(false)
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const gerarPix = async (parcelaId: string) => {
    setGeneratingPix(parcelaId)
    try {
      const res = await fetch(`/api/parcelas/${parcelaId}/pix`, { method: 'POST' })
      const json = await res.json()
      if (json.data) {
        setPixModal({
          qrCode: json.data.qrCode,
          qrCodeText: json.data.qrCodeText,
          valor: json.data.valor,
        })
      } else {
        alert('Erro ao gerar PIX. Tente novamente.')
      }
    } catch {
      alert('Erro ao gerar PIX.')
    }
    setGeneratingPix(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at top, #111827 0%, #0a0e1a 70%)' }}>
      <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #111827 0%, #0a0e1a 70%)' }}>
      <div className="glass-card p-8 text-center max-w-sm">
        <span className="text-4xl block mb-4">🔒</span>
        <h1 className="text-xl font-bold mb-2">Link Inválido</h1>
        <p className="text-text-muted text-sm">Este link não é válido ou expirou. Entre em contato com o administrador.</p>
      </div>
    </div>
  )

  const pendingParcelas = data.emprestimos.flatMap(e => e.parcelas).filter(p => p.status !== 'PAGO').sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top, #111827 0%, #0a0e1a 70%)' }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(10,14,26,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          </div>
          <div>
            <h1 className="font-bold text-sm">LoanPro</h1>
            <p className="text-xs text-text-muted">Portal do Cliente</p>
          </div>
        </div>
        <span className="text-sm font-medium text-text-primary">Olá, {data.nome.split(' ')[0]} 👋</span>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-4 animate-in pb-20">
        {/* Summary */}
        <div className="glass-card p-5" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
          <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Saldo Devedor Total</p>
          <p className="text-3xl font-bold gradient-text">{fmt(data.saldoDevedor)}</p>
          {data.proximaParcela && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-text-muted">Próxima parcela:</span>
              <span className="font-medium text-text-primary">{fmt(data.proximaParcela.valor)}</span>
              <span className="text-text-muted">em</span>
              <span className="font-medium text-accent">{fmtDate(data.proximaParcela.vencimento)}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('parcelas')} className={`btn-sm flex-1 justify-center ${tab === 'parcelas' ? 'btn-primary' : 'btn-secondary'}`}>
            Parcelas ({pendingParcelas.length})
          </button>
          <button onClick={() => setTab('historico')} className={`btn-sm flex-1 justify-center ${tab === 'historico' ? 'btn-primary' : 'btn-secondary'}`}>
            Histórico ({data.historico.length})
          </button>
        </div>

        {tab === 'parcelas' ? (
          <div className="space-y-2">
            {pendingParcelas.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <span className="text-4xl block mb-3">🎉</span>
                <p className="font-semibold">Tudo em dia!</p>
                <p className="text-text-muted text-sm mt-1">Nenhuma parcela pendente</p>
              </div>
            ) : (
              pendingParcelas.map((p) => (
                <div key={p.id} className="glass-card p-4" style={p.status === 'ATRASADO' ? { borderColor: 'rgba(239,68,68,0.3)' } : {}}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Parcela {p.numero}</span>
                      <span className={`badge ${statusBadge[p.status]}`}>{p.status}</span>
                    </div>
                    <span className="font-mono font-semibold text-text-primary">{fmt(p.valor)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Vence: {fmtDate(p.vencimento)}</span>
                    <button
                      onClick={() => gerarPix(p.id)}
                      disabled={generatingPix === p.id}
                      className="btn-primary btn-sm"
                    >
                      {generatingPix === p.id ? (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Gerando...
                        </span>
                      ) : (
                        'Pagar PIX'
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {data.historico.length === 0 ? (
              <div className="glass-card p-8 text-center text-text-muted">Nenhum pagamento registrado</div>
            ) : (
              data.historico.map((p) => (
                <div key={p.id} className="glass-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Parcela {p.numero}</span>
                        <span className="badge badge-success">PAGO</span>
                      </div>
                      <span className="text-xs text-text-muted">{p.dataPagamento ? fmtDate(p.dataPagamento) : '—'}</span>
                    </div>
                    <span className="font-mono text-green-400">{fmt(p.valorPago || p.valor)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* PIX Modal */}
      {pixModal && (
        <div className="modal-overlay" onClick={() => setPixModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2 text-center">Pagamento PIX</h2>
            <p className="text-center text-2xl font-bold gradient-text mb-4">{fmt(pixModal.valor)}</p>

            {pixModal.qrCode && (
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-xl">
                  <img src={pixModal.qrCode} alt="QR Code PIX" className="w-48 h-48" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Código Copia e Cola</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={pixModal.qrCodeText} className="input-field text-xs font-mono" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixModal.qrCodeText)
                    alert('Código copiado!')
                  }}
                  className="btn-primary btn-sm flex-shrink-0"
                >
                  📋
                </button>
              </div>
            </div>

            <p className="text-xs text-text-muted text-center mt-4">
              Após o pagamento, a confirmação é automática via PIX.
            </p>

            <button onClick={() => setPixModal(null)} className="btn-secondary w-full justify-center mt-4">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
