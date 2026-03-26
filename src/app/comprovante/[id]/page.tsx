'use client'

import { useState, useEffect, use } from 'react'
import { useSearchParams } from 'next/navigation'
import Script from 'next/script'

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
const tipoLabel: Record<string, string> = { 
  PRICE: 'Parcelas Fixas (Amortizável)', 
  SIMPLE: 'Juros Simples', 
  BULLET: 'Pagar Só Juros'
}

declare const html2pdf: any

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [data, setData] = useState<ReceiptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

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

  const generatePDF = async () => {
    if (!data) return
    setExporting(true)
    const element = document.getElementById('receipt-content')
    const opt = {
      margin: 10,
      filename: `Comprovante_${data.clienteNome.replace(/\s+/g, '_')}_Parc_${data.numero}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }
    
    try {
      if (typeof html2pdf === 'undefined') {
        alert('Carregando biblioteca... tente novamente em 2 segundos.')
        setExporting(false)
        return
      }
      await html2pdf().set(opt).from(element).save()
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Erro ao gerar o PDF. Use o botão de imprimir do navegador.')
    } finally {
      setExporting(false)
    }
  }

  const sharePDF = async () => {
    if (!data) return
    setExporting(true)
    
    const element = document.getElementById('receipt-content')
    const opt = {
      margin: 10,
      filename: `Comprovante_${data.clienteNome.replace(/\s+/g, '_')}_Parc_${data.numero}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }
    
    try {
      if (typeof html2pdf === 'undefined') {
        alert('Carregando biblioteca... tente novamente em 2 segundos.')
        return
      }
      
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob')
      const file = new File([pdfBlob], opt.filename, { type: 'application/pdf' })
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Comprovante de Pagamento',
          text: `Comprovante da Parcela ${data.numero} - ${data.clienteNome}`
        })
      } else {
        // Fallback to save
        await html2pdf().set(opt).from(element).save()
      }
    } catch (err) {
      console.error('Error sharing PDF:', err)
      // Fallback
      await html2pdf().set(opt).from(element).save()
    } finally {
      setExporting(false)
    }
  }

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
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0 print:px-0 font-sans">
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" strategy="lazyOnload" />
      
      <div className="max-w-xl mx-auto space-y-4">
        {/* Actions - Hidden on print */}
        <div className="bg-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between print:hidden border border-slate-200">
          <button onClick={() => window.close()} className="text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium order-2 sm:order-1">← Sair</button>
          <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
            <button 
              onClick={sharePDF}
              disabled={exporting}
              className="flex-1 bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>📩</span> {exporting ? 'Aguarde...' : 'Enviar PDF'}
            </button>
            <button 
              onClick={() => window.print()}
              className="bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-slate-900 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>🖨️</span> Imprimir
            </button>
          </div>
        </div>

        {/* Receipt Wrapper for PDF Capture */}
        <div id="receipt-content" className="bg-white shadow-xl rounded-[2rem] overflow-hidden print:shadow-none print:rounded-none">
          <div className="p-8 md:p-12 space-y-10">
            <div className="text-center space-y-2">
              <div className="inline-block px-4 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full mb-2">Pagamento Confirmado</div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Comprovante</h1>
              <p className="text-slate-400 text-xs font-mono tracking-tighter">REF: {data.id.toUpperCase()}</p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-8 border-b border-slate-100 pb-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                  <p className="text-lg font-black text-slate-800 leading-tight">{data.clienteNome}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data</p>
                  <p className="text-lg font-black text-slate-800 leading-tight">{fmtDate(data.dataPagamento)}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-[1.5rem] p-8 text-center ring-1 ring-inset ring-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Valor Recebido</p>
                <p className="text-5xl font-black text-slate-900 tracking-tighter">{fmt(data.valorPago)}</p>
                <div className="flex justify-center gap-2 mt-4">
                  <span className="text-[11px] font-bold bg-white text-slate-600 px-3 py-1 rounded-full border border-slate-200">via {data.formaPagamento}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-2">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Referente à</p>
                  <p className="text-sm font-black text-slate-700">Parcela {data.numero} de {data.totalParcelas}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{tipoLabel[data.emprestimoTipo] || data.emprestimoTipo} • Venc. {fmtDate(data.vencimento)}</p>
                </div>
                <div className="text-right flex flex-col justify-end">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-none">Status</p>
                    <p className="text-sm font-black text-emerald-600">QUITADO</p>
                </div>
              </div>
            </div>

            <div className="pt-8 text-center border-t border-slate-100 space-y-4">
              <div className="flex justify-center opacity-30">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                Este recibo é digital e tem validade como comprovante de quitação da parcela identificada acima. Gerado em {fmtDateTime(new Date())}.
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-center text-slate-400 text-[10px] font-medium print:hidden">
            Documento gerado pelo sistema de gestão de crédito.
        </p>
      </div>
    </div>
  )
}
