'use client'

import { useState, useEffect, use } from 'react'
import { useSearchParams } from 'next/navigation'

interface ReceiptData {
  id: string
  numero: number
  totalParcelas: number
  valorPago: number
  dataPagamento: string
  formaPagamento: string
  clienteNome: string
  emprestimoTipo: string
  vencimento: string
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const fmtDateTime = (d: Date) => d.toLocaleString('pt-BR')

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = `/api/comprovante/${id}${token ? `?token=${token}` : ''}`
    fetch(url)
      .then(r => r.json())
      .then(j => {
        if (j.error) setError(j.error)
        else setData(j.data)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar comprovante')
        setLoading(false)
      })
  }, [id, token])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
  
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Ops!</h1>
        <p className="text-slate-500 mb-6">{error || 'Comprovante não disponível'}</p>
        <button onClick={() => window.close()} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium">Fechar Janela</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden print:shadow-none print:rounded-none">
        {/* Actions - Hidden on print */}
        <div className="bg-slate-800 p-4 flex justify-between items-center print:hidden">
          <button onClick={() => window.close()} className="text-white/70 hover:text-white transition-colors text-sm font-medium">← Sair</button>
          <button 
            onClick={() => window.print()}
            className="bg-white text-slate-800 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2"
          >
            <span>🖨️</span> Imprimir Comprovante
          </button>
        </div>

        {/* Receipt Body */}
        <div className="p-8 md:p-12 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Comprovante de Pagamento</h1>
            <p className="text-slate-400 text-sm font-medium">ID: {data.id.toUpperCase()}</p>
          </div>

          <div className="border-y border-slate-100 py-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Pagador</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{data.clienteNome}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Data do Pagamento</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{fmtDate(data.dataPagamento)}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">Valor Pago</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter">{fmt(data.valorPago)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Referente à</p>
                <p className="text-sm font-semibold text-slate-700">Parcela {data.numero} de {data.totalParcelas}</p>
                <p className="text-xs text-slate-500 mt-1">Empréstimo {data.emprestimoTipo} • Venc. {fmtDate(data.vencimento)}</p>
              </div>
              <div className="md:text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Forma de Pagamento</p>
                <p className="text-sm font-semibold text-slate-700">{data.formaPagamento}</p>
              </div>
            </div>
          </div>

          <div className="text-center pt-4 space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-1 px-4 bg-slate-100 rounded-full" />
            </div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Autenticado Digitalmente</p>
            <p className="text-[9px] text-slate-300 leading-relaxed max-w-xs mx-auto">
              Este documento é um comprovante de recebimento de valores gerado automaticamente pelo sistema em {fmtDateTime(new Date())}.
            </p>
          </div>
        </div>
      </div>
      
      <p className="text-center text-slate-300 text-[10px] mt-8 print:hidden">
        Dica: Você pode salvar este documento como PDF usando a função de imprimir do seu navegador.
      </p>
    </div>
  )
}
