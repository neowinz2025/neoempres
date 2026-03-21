'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

interface DashboardData {
  capitalEmprestado: number
  capitalEmAberto: number
  totalRecebido: number
  jurosRecebidos: number
  parcelasAtrasadas: number
  valorAtrasado: number
  inadimplencia: number
  roi: number
  totalClientes: number
  totalEmprestimos: number
  monthlyData: { mes: string; recebido: number; emprestado: number }[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => {
        setData(json.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-card p-5 h-24 shimmer rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-center text-text-muted py-12">Erro ao carregar dados</div>
  }

  const stats = [
    { label: 'Capital Emprestado', value: formatCurrency(data.capitalEmprestado), color: '#6366f1', icon: '💎' },
    { label: 'Capital Em Aberto', value: formatCurrency(data.capitalEmAberto), color: '#f59e0b', icon: '⏳' },
    { label: 'Total Recebido', value: formatCurrency(data.totalRecebido), color: '#10b981', icon: '✅' },
    { label: 'Juros Recebidos', value: formatCurrency(data.jurosRecebidos), color: '#3b82f6', icon: '📈' },
    { label: 'Parcelas Atrasadas', value: String(data.parcelasAtrasadas), color: '#ef4444', icon: '⚠️' },
    { label: 'Valor em Atraso', value: formatCurrency(data.valorAtrasado), color: '#ef4444', icon: '🚨' },
    { label: 'Inadimplência', value: `${data.inadimplencia}%`, color: data.inadimplencia > 10 ? '#ef4444' : '#f59e0b', icon: '📊' },
    { label: 'ROI da Carteira', value: `${data.roi}%`, color: '#10b981', icon: '🏆' },
  ]

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">Visão geral da carteira de empréstimos</p>
        </div>
        <div className="flex gap-2">
          <span className="badge badge-accent">{data.totalClientes} clientes</span>
          <span className="badge badge-info">{data.totalEmprestimos} empréstimos</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="glass-card stat-card slide-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">{stat.label}</span>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <div className="stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Portfolio Evolution */}
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4 text-sm">Evolução da Carteira</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyData}>
                <defs>
                  <linearGradient id="colorEmprestado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3050" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1a1f36', border: '1px solid #2a3050', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Area type="monotone" dataKey="emprestado" stroke="#6366f1" fill="url(#colorEmprestado)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payments Flow */}
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4 text-sm">Fluxo de Recebimentos</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3050" />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#1a1f36', border: '1px solid #2a3050', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Bar dataKey="recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
