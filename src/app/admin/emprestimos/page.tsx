'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Emprestimo {
  id: string; valor: number; taxaJuros: number; tipo: string; numParcelas: number; valorParcela: number
  saldoDevedor: number; status: string; createdAt: string
  cliente: { id: string; nome: string; telefone: string; score: string }
}

const statusBadge: Record<string, string> = {
  ATIVO: 'badge-accent', QUITADO: 'badge-success', RENEGOCIADO: 'badge-info', INADIMPLENTE: 'badge-danger',
}
const tipoLabel: Record<string, string> = { 
  PRICE: 'Parcelas Fixas (Amortizável)', 
  SIMPLE: 'Juros Simples', 
  BULLET: 'Pagar Só Juros'
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function EmprestimosPage() {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = filter ? `?status=${filter}` : ''
    const res = await fetch(`/api/emprestimos${params}`)
    const json = await res.json()
    setEmprestimos(json.data || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Empréstimos</h1>
          <p className="text-text-muted text-sm mt-1">{emprestimos.length} empréstimo(s)</p>
        </div>
        <Link href="/admin/emprestimos/novo" className="btn-primary">
          + Novo Empréstimo
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'ATIVO', 'QUITADO', 'RENEGOCIADO', 'INADIMPLENTE'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}
          >
            {s || 'Todos'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
      ) : (
        <>
          {/* Desktop */}
          <div className="glass-card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th><th>Valor</th><th>Taxa</th><th>Tipo</th><th>Parcelas</th><th>Saldo Devedor</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {emprestimos.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-text-primary">{e.cliente.nome}</td>
                      <td className="font-mono text-sm">{fmt(e.valor)}</td>
                       <td>{e.taxaJuros}%</td>
                       <td><span className="badge badge-accent">{tipoLabel[e.tipo] || e.tipo}</span></td>
                      <td>{e.numParcelas}x {fmt(e.valorParcela)}</td>
                      <td className="font-mono text-sm text-yellow-400">{fmt(e.saldoDevedor)}</td>
                      <td><span className={`badge ${statusBadge[e.status]}`}>{e.status}</span></td>
                      <td><Link href={`/admin/emprestimos/${e.id}`} className="btn-secondary btn-sm text-xs">Ver →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {emprestimos.map((e) => (
              <Link key={e.id} href={`/admin/emprestimos/${e.id}`} className="glass-card p-4 block">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{e.cliente.nome}</span>
                  <span className={`badge ${statusBadge[e.status]}`}>{e.status}</span>
                </div>
                 <div className="flex items-center justify-between text-sm">
                   <span className="text-text-secondary">{fmt(e.valor)} • {tipoLabel[e.tipo] || e.tipo}</span>
                   <span className="font-mono text-yellow-400">{fmt(e.saldoDevedor)}</span>
                 </div>
                <div className="text-xs text-text-muted mt-1">{e.numParcelas}x {fmt(e.valorParcela)} • {e.taxaJuros}% a.m.</div>
              </Link>
            ))}
          </div>

          {emprestimos.length === 0 && (
            <div className="text-center py-12 text-text-muted">Nenhum empréstimo encontrado</div>
          )}
        </>
      )}
    </div>
  )
}
