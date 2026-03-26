'use client'

import { useState, useEffect, use, useCallback } from 'react'

interface Parcela {
  id: string; numero: number; valor: number; valorOriginal: number; vencimento: string; status: string
  dataPagamento: string | null; valorPago: number | null; multa: number | null; jurosAtraso: number | null
}
interface Emprestimo {
  id: string; valor: number; valorTotal: number; tipo: string; status: string; saldoDevedor: number
  jurosDiario: number; numParcelas: number; totalPago: number
  parcelas: Parcela[]
}
interface ClienteData {
  nome: string; telefone: string; saldoDevedor: number
  proximaParcela: Parcela | null
  emprestimos: Emprestimo[]
  historico: Parcela[]
}

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }

const statusLabel: Record<string, string> = {
  PENDENTE: 'Pendente', ATRASADO: 'Atrasado', PAGO: 'Pago', PARCIAL: 'Parcial',
}
const statusColor: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800', ATRASADO: 'bg-red-100 text-red-700',
  PAGO: 'bg-green-100 text-green-700', PARCIAL: 'bg-blue-100 text-blue-700',
}

export default function ClientePortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<ClienteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pixModal, setPixModal] = useState<{ qrCode: string | null; qrCodeText: string; valor: number } | null>(null)
  const [pixAmountModal, setPixAmountModal] = useState<{ parcelaId: string; valorRestante: number } | null>(null)
  const [pixAmountInput, setPixAmountInput] = useState('')
  const [generatingPix, setGeneratingPix] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => setToastMsg(''), 4000)
  }

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

  const gerarPix = async (parcelaId: string, valorPagamento?: number) => {
    setGeneratingPix(parcelaId)
    try {
      const res = await fetch(`/api/parcelas/${parcelaId}/pix`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: valorPagamento ? JSON.stringify({ valorPagamento }) : undefined
      })
      const json = await res.json()
      if (json.data) {
        setPixModal({
          qrCode: json.data.qrCode,
          qrCodeText: json.data.qrCodeText,
          valor: json.data.valor,
        })
      } else {
        showToast('Erro ao gerar PIX. Tente novamente.', 'error')
      }
    } catch {
      showToast('Erro ao gerar PIX.', 'error')
    }
    setGeneratingPix(null)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)' }}>
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)' }}>
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-xl">
        <span className="text-4xl block mb-4">🔒</span>
        <h1 className="text-xl font-bold text-slate-800 mb-2">Link Inválido</h1>
        <p className="text-slate-500 text-sm">Este link não é válido ou expirou. Entre em contato com o administrador.</p>
      </div>
    </div>
  )

  const tipoLabel: Record<string, string> = { MENSAL: 'Mensal', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal' }

  return (
    <div className="min-h-screen pb-10" style={{ background: 'linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)' }}>
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[9999] px-4 py-3 rounded-xl shadow-lg border text-white text-sm font-medium text-center ${toastType === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'}`}>
          {toastMsg}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-4 animate-in">
        {/* Per Emprestimo cards */}
        {data.emprestimos.filter(e => e.status === 'ATIVO').map(emp => {
          const pendingParcelas = emp.parcelas.filter(p => p.status !== 'PAGO').sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
          const totalComJuros = emp.valorTotal

          return (
            <div key={emp.id} className="space-y-4">
              {/* Client Header Card */}
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Name + Phone */}
                <div className="flex items-center gap-3 p-5 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-lg font-bold">$</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold text-slate-800 tracking-tight uppercase">{data.nome}</h1>
                    <p className="text-sm text-slate-500">{data.telefone}</p>
                  </div>
                </div>

                {/* Three Stat Cards */}
                <div className="grid grid-cols-3 gap-3 px-5 pb-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wider">Valor do Empréstimo</p>
                    <p className="text-lg font-bold text-green-800 mt-1">{fmt(emp.valor)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Total Pago</p>
                    <p className="text-lg font-bold text-blue-800 mt-1">{fmt(emp.totalPago)}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">Total Restante</p>
                    <p className="text-lg font-bold text-red-800 mt-1">{fmt(emp.saldoDevedor)}</p>
                  </div>
                </div>

                {/* Detail Row */}
                <div className="grid grid-cols-4 gap-2 px-5 pb-5 text-xs text-slate-600">
                  <div>
                    <p className="text-slate-400 font-medium">Total com Juros</p>
                    <p className="font-semibold text-slate-700">{fmt(totalComJuros)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Taxa de Juros</p>
                    <p className="font-semibold text-slate-700">{emp.jurosDiario}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Parcelas</p>
                    <p className="font-semibold text-slate-700">{emp.numParcelas}x</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Tipo</p>
                    <p className="font-semibold text-slate-700">{tipoLabel[emp.tipo] || emp.tipo}</p>
                  </div>
                </div>
              </div>

              {/* Parcelas Card */}
              <div className="bg-white rounded-2xl shadow-lg p-5">
                <h2 className="text-lg font-bold text-slate-800 mb-4">Parcelas</h2>

                {pendingParcelas.length === 0 ? (
                  <div className="text-center py-6">
                    <span className="text-3xl block mb-2">🎉</span>
                    <p className="font-semibold text-slate-700">Tudo em dia!</p>
                    <p className="text-slate-400 text-sm">Nenhuma parcela pendente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingParcelas.map((p) => {
                      const totalParcelas = emp.numParcelas
                      const restante = p.valor - (p.valorPago || 0)
                      return (
                        <div key={p.id} className="border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-800">Parcela {p.numero}/{totalParcelas}</span>
                              <span className="text-slate-400">⏱</span>
                            </div>
                            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusColor[p.status] || 'bg-slate-100 text-slate-600'}`}>
                              {statusLabel[p.status] || p.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                            <span>💲 {fmt(restante)}</span>
                            <span>📅 {fmtDate(p.vencimento)}</span>
                          </div>
                          <div className="flex gap-2">
                            {/* Pagar Completo */}
                            <button
                              onClick={() => gerarPix(p.id, restante)}
                              disabled={generatingPix === p.id}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <span>📱</span>
                              {generatingPix === p.id ? 'Gerando...' : 'Pagar Completo'}
                            </button>
                            {/* Pagar só Juros — opens amount modal */}
                            <button
                              onClick={() => {
                                const interest = emp.valor * (emp.jurosDiario / 100)
                                const val = emp.tipo === 'BULLET' ? interest : restante
                                setPixAmountInput(val.toFixed(2))
                                setPixAmountModal({ parcelaId: p.id, valorRestante: restante })
                              }}
                              disabled={generatingPix === p.id}
                              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <span>📱</span> Pagar só Juros
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Paid History Card */}
              {emp.parcelas.filter(p => p.status === 'PAGO' || p.status === 'PARCIAL').length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-5">
                  <h2 className="text-lg font-bold text-slate-800 mb-4">Pagamentos Realizados</h2>
                  <div className="space-y-3">
                    {emp.parcelas
                      .filter(p => p.status === 'PAGO' || p.status === 'PARCIAL')
                      .sort((a, b) => new Date(b.dataPagamento || b.vencimento).getTime() - new Date(a.dataPagamento || a.vencimento).getTime())
                      .map((p) => (
                        <div key={p.id} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-sm text-slate-800">Parcela {p.numero}</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">Pagamento Realizado</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              {p.dataPagamento ? `Pago em ${fmtDate(p.dataPagamento)}` : 'Confirmado'} • {fmt(p.valorPago || 0)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => window.open(`/comprovante/${p.id}?token=${token}`, '_blank')}
                              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                            >
                              🧾 Recibo
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* PIX Amount Modal */}
      {pixAmountModal && (
        <div className="modal-overlay" onClick={() => setPixAmountModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-2 text-center">Valor do Pagamento</h2>
            <p className="text-sm text-slate-500 text-center mb-4">
              Informe o valor que deseja pagar. O saldo restante é de <strong className="text-slate-800">{fmt(pixAmountModal.valorRestante)}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-slate-600 text-center">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={pixAmountInput}
                onChange={(e) => setPixAmountInput(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-center text-xl font-bold font-mono tracking-wider focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPixAmountModal(null)} className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(pixAmountInput.replace(',', '.'))
                  if (isNaN(val) || val <= 0 || val > pixAmountModal.valorRestante) {
                    showToast('Valor inválido ou maior que o restante.', 'error')
                    return
                  }
                  setPixAmountModal(null)
                  gerarPix(pixAmountModal.parcelaId, val)
                }}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Gerar PIX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIX QR Code Modal */}
      {pixModal && (
        <div className="modal-overlay" onClick={() => setPixModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-2 text-center">Pagamento PIX</h2>
            <p className="text-center text-2xl font-bold text-emerald-600 mb-4">{fmt(pixModal.valor)}</p>

            {pixModal.qrCode && (
              <div className="flex justify-center mb-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <img src={pixModal.qrCode} alt="QR Code PIX" className="w-48 h-48" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Código Copia e Cola</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={pixModal.qrCodeText} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pixModal.qrCodeText)
                    showToast('Código PIX copiado com sucesso!', 'success')
                  }}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
                >
                  📋
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 text-center mt-4">
              Após o pagamento, a confirmação é automática via PIX.
            </p>

            <button onClick={() => setPixModal(null)} className="w-full mt-4 py-2.5 border border-slate-300 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
