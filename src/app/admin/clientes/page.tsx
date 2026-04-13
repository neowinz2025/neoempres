'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Cliente {
  id: string
  nome: string
  telefone: string
  score: string
  token: string
  createdAt: string
  emprestimos: { id: string; saldoDevedor: number; status: string }[]
}

const scoreColors: Record<string, string> = {
  A: 'badge-success',
  B: 'badge-info',
  C: 'badge-warning',
  D: 'badge-danger',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [notificarWpp, setNotificarWpp] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchClientes = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/clientes?search=${search}`)
    const json = await res.json()
    setClientes(json.data || [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(fetchClientes, 300)
    return () => clearTimeout(timer)
  }, [fetchClientes])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone, notificarWpp }),
    })
    setShowModal(false)
    setNome('')
    setTelefone('')
    setNotificarWpp(true)
    setSaving(false)
    fetchClientes()
  }

  return (
    <div className="space-y-5 animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-text-muted text-sm mt-1">{clientes.length} clientes cadastrados</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          + Novo Cliente
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por nome ou telefone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field max-w-md"
      />

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass-card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Score</th>
                    <th>Empréstimos</th>
                    <th>Saldo Devedor</th>
                    <th>Portal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => {
                    const saldo = c.emprestimos.reduce((s, e) => s + e.saldoDevedor, 0)
                    const ativos = c.emprestimos.filter((e) => e.status === 'ATIVO').length
                    return (
                      <tr key={c.id}>
                        <td className="font-medium text-text-primary">{c.nome}</td>
                        <td>{c.telefone}</td>
                        <td><span className={`badge ${scoreColors[c.score]}`}>{c.score}</span></td>
                        <td>{ativos} ativo(s)</td>
                        <td className="font-mono text-sm">{formatCurrency(saldo)}</td>
                        <td>
                          <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/cliente/${c.token}`)}
                            className="btn-secondary btn-sm text-xs"
                          >
                            📋 Copiar Link
                          </button>
                        </td>
                        <td>
                          <Link href={`/admin/clientes/${c.id}`} className="btn-secondary btn-sm text-xs">
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {clientes.map((c) => {
              const saldo = c.emprestimos.reduce((s, e) => s + e.saldoDevedor, 0)
              return (
                <Link key={c.id} href={`/admin/clientes/${c.id}`} className="glass-card p-4 block">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{c.nome}</span>
                    <span className={`badge ${scoreColors[c.score]}`}>{c.score}</span>
                  </div>
                  <div className="text-sm text-text-secondary">{c.telefone}</div>
                  <div className="text-sm font-mono text-accent mt-1">{formatCurrency(saldo)}</div>
                </Link>
              )
            })}
          </div>

          {clientes.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              Nenhum cliente encontrado
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-5">Novo Cliente</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input-field"
                  placeholder="Nome completo"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Telefone</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="input-field"
                  placeholder="(11) 99999-9999"
                  required
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-slate-700 block">Receber Cobrança via WhatsApp</label>
                  <p className="text-xs text-slate-500">Enviar mensagens via Evolution API</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setNotificarWpp(!notificarWpp)} 
                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer border-2 ${notificarWpp ? 'bg-[#0284c7] border-[#0284c7]' : 'bg-slate-200 border-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${notificarWpp ? 'right-0.5' : 'left-0.5'}`}></div>
                </button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? 'Salvando...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
