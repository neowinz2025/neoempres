'use client'

import { useState, useEffect } from 'react'

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/configs')
      .then(r => r.json())
      .then(j => {
        setConfigs(j.data || {})
        setLoading(false)
      })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/configs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configs)
    })
    
    setSaving(false)
    if (res.ok) alert('Configurações salvas com sucesso!')
    else alert('Erro ao salvar as configurações. Verifique se você é administrador.')
  }

  const handleChange = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }))
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
        <p className="text-sm text-text-muted mt-1">Configure as taxas padrão e integrações de API</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Financeiro */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-accent uppercase tracking-wide text-sm flex items-center gap-2">
            <span>💰</span> Taxas Padrão de Atraso
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Multa por Atraso (%)</label>
              <input type="number" step="0.01" value={configs['MULTA_PERCENT'] || ''} onChange={(e) => handleChange('MULTA_PERCENT', e.target.value)} className="input-field" placeholder="2.0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Juros Diário (%)</label>
              <input type="number" step="0.001" value={configs['JUROS_DIARIO'] || ''} onChange={(e) => handleChange('JUROS_DIARIO', e.target.value)} className="input-field" placeholder="0.033" />
            </div>
          </div>
        </div>

        {/* PIX */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-accent uppercase tracking-wide text-sm flex items-center gap-2">
            <span>⚡</span> Integração PIX (FastDePix)
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">API Key</label>
              <input type="password" value={configs['FASTDEPIX_API_KEY'] || ''} onChange={(e) => handleChange('FASTDEPIX_API_KEY', e.target.value)} className="input-field" placeholder="Sua chave da API..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Webhook Secret (Assinatura)</label>
              <input type="password" value={configs['FASTDEPIX_WEBHOOK_SECRET'] || ''} onChange={(e) => handleChange('FASTDEPIX_WEBHOOK_SECRET', e.target.value)} className="input-field" placeholder="Segredo para validar os webhooks..." />
            </div>
          </div>
        </div>

        {/* WhatsApp & Telegram */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-accent uppercase tracking-wide text-sm flex items-center gap-2">
            <span>📱</span> Notificações
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 mb-4" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Z-API Instance ID</label>
              <input type="text" value={configs['ZAPI_INSTANCE_ID'] || ''} onChange={(e) => handleChange('ZAPI_INSTANCE_ID', e.target.value)} className="input-field" placeholder="Ex: 3B4E..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Z-API Token</label>
              <input type="password" value={configs['ZAPI_TOKEN'] || ''} onChange={(e) => handleChange('ZAPI_TOKEN', e.target.value)} className="input-field" placeholder="Seu token auth..." />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Telegram Bot Token</label>
              <input type="password" value={configs['TELEGRAM_BOT_TOKEN'] || ''} onChange={(e) => handleChange('TELEGRAM_BOT_TOKEN', e.target.value)} className="input-field" placeholder="Token do BotFather..." />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center text-lg py-3">
          {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
        </button>
      </form>
    </div>
  )
}
