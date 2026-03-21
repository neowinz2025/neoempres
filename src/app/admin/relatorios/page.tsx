'use client'

import { useState } from 'react'

export default function RelatoriosPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const download = async (tipo: string, formato: string) => {
    setLoading(`${tipo}-${formato}`)
    try {
      const res = await fetch(`/api/relatorios?tipo=${tipo}&formato=${formato}`)
      if (formato === 'json') {
        const json = await res.json()
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `relatorio_${tipo}.json`; a.click()
        URL.revokeObjectURL(url)
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `relatorio_${tipo}.${formato}`; a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      showToast('Erro ao gerar relatório')
    }
    setLoading(null)
  }

  const reports = [
    { tipo: 'carteira', title: 'Carteira Ativa', desc: 'Todos os empréstimos ativos com dados de cliente e saldo', icon: '📋' },
    { tipo: 'inadimplencia', title: 'Inadimplência', desc: 'Parcelas em atraso com dias de atraso e valores', icon: '⚠️' },
    { tipo: 'fluxo', title: 'Fluxo de Caixa', desc: 'Recebimentos futuros previstos e parcelas pendentes', icon: '💰' },
  ]

  return (
    <div className="space-y-5 animate-in relative">
      {toastMsg && (
        <div className="fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[9999] px-4 py-4 md:py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-5 border text-white text-sm font-medium text-center bg-red-900/95 border-red-500">
          {toastMsg}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-text-muted text-sm mt-1">Exporte dados da carteira em diversos formatos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.tipo} className="glass-card p-5 space-y-4">
            <div>
              <span className="text-2xl">{r.icon}</span>
              <h3 className="font-semibold mt-2">{r.title}</h3>
              <p className="text-text-muted text-sm mt-1">{r.desc}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['csv', 'xlsx', 'json'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => download(r.tipo, fmt)}
                  disabled={loading === `${r.tipo}-${fmt}`}
                  className="btn-secondary btn-sm flex-1 justify-center uppercase"
                >
                  {loading === `${r.tipo}-${fmt}` ? '...' : fmt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
