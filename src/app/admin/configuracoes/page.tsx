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
        {/* Marca / Logo */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-accent uppercase tracking-wide text-sm flex items-center gap-2">
            <span>🎨</span> Personalização da Marca
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Logo do Sistema (Favicon & Painel)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-2 overflow-hidden flex-shrink-0">
                  {configs['APP_LOGO'] ? (
                    <img src={configs['APP_LOGO']} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs text-text-muted">Sem logo</span>
                  )}
                </div>
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 1024 * 1024) return alert('A logo deve ter no máximo 1MB.')
                        const reader = new FileReader()
                        reader.onload = (ev) => setConfigs(prev => ({ ...prev, APP_LOGO: ev.target?.result as string }))
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
                  />
                  <p className="text-xs text-text-muted mt-2">Recomendado: Imagem quadrada em formato PNG transparente ou SVG. Max 1MB.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            <span>⚡</span> Integração PIX (Geral)
          </h2>
          <div className="grid grid-cols-1 gap-4 border-b border-border pb-4 mb-4" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">URL Pública do Seu Sistema (Para Webhooks)</label>
              <input type="url" value={configs['APP_WEBHOOK_URL'] || ''} onChange={(e) => handleChange('APP_WEBHOOK_URL', e.target.value)} className="input-field" placeholder="https://seu-sistema.vercel.app/api/webhook/pix" />
            </div>
          </div>

          <h3 className="font-semibold text-text-primary text-sm mt-4">FastDePix (Principal)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border pb-4 mb-4" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">API Key (FastDePix)</label>
              <input type="password" value={configs['FASTDEPIX_API_KEY'] || ''} onChange={(e) => handleChange('FASTDEPIX_API_KEY', e.target.value)} className="input-field" placeholder="Sua chave..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Webhook Secret (FastDePix)</label>
              <input type="password" value={configs['FASTDEPIX_WEBHOOK_SECRET'] || ''} onChange={(e) => handleChange('FASTDEPIX_WEBHOOK_SECRET', e.target.value)} className="input-field" placeholder="Segredo..." />
            </div>
          </div>

          <h3 className="font-semibold text-text-primary text-sm mt-4">AtlasDao (Fallback Secundário)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">API Key (AtlasDao)</label>
              <input type="password" value={configs['ATLASDAO_API_KEY'] || ''} onChange={(e) => handleChange('ATLASDAO_API_KEY', e.target.value)} className="input-field" placeholder="Sua chave..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Webhook Secret (AtlasDao)</label>
              <input type="password" value={configs['ATLASDAO_WEBHOOK_SECRET'] || ''} onChange={(e) => handleChange('ATLASDAO_WEBHOOK_SECRET', e.target.value)} className="input-field" placeholder="Segredo HMAC..." />
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
