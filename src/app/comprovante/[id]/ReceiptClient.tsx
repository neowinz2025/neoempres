'use client'

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

export default function ReceiptClient({ data, error }: { data: ReceiptData | null, error?: string }) {
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
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const text = encodeURIComponent(`Olá! Segue meu comprovante de pagamento:\n\n*Parcela ${data.numero}/${data.totalParcelas}*\n*Valor:* ${fmt(data.valorPago)}\n*Data:* ${fmtDate(data.dataPagamento)}\n\nLink: ${window.location.href}`)
                window.open(`https://wa.me/?text=${text}`, '_blank')
              }}
              className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2"
            >
              <span>💬</span> Compartilhar
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-white text-slate-800 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2"
            >
              <span>🖨️</span> Imprimir
            </button>
          </div>
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
    </div>
  )
}
