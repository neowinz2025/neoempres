'use client'

import { useState, useEffect } from 'react'

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setTimeout(() => setToastMsg(''), 4000)
  }

  // Senha states
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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

    try {
      const res = await fetch('/api/configs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      })
      if (!res.ok) throw new Error('Erro ao salvar as configurações.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro genérico ao salvar configs', 'error')
      setSaving(false)
      return
    }

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        showToast('As senhas não coincidem!', 'error')
        setSaving(false)
        return
      }
      if (newPassword.length < 6) {
        showToast('A senha deve ter no mínimo 6 caracteres!', 'error')
        setSaving(false)
        return
      }

      try {
        const resPass = await fetch('/api/auth/password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
        })
        const data = await resPass.json()
        if (!resPass.ok) throw new Error(data.error || 'Erro ao alterar a senha')
        
        setNewPassword('')
        setConfirmPassword('')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erro ao trocar senha', 'error')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    showToast('Configurações aplicadas com sucesso!', 'success')
  }

  const handleChange = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }))
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in relative">
      {toastMsg && (
        <div className={`fixed top-4 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[9999] px-4 py-4 md:py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-5 border text-white text-sm font-medium text-center ${toastType === 'success' ? 'bg-[#1a1b26] border-accent' : 'bg-red-900/95 border-red-500'}`}>
          {toastMsg}
        </div>
      )}

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
                        if (file.size > 1024 * 1024) return showToast('A logo deve ter no máximo 1MB.', 'error')
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

        {/* Alterar Senha de Acesso */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-accent uppercase tracking-wide text-sm flex items-center gap-2">
            <span>🔒</span> Segurança e Acesso
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nova Senha</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" placeholder="Nova senha de administrador" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Confirmar Senha</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" placeholder="Repita a mesma senha" />
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Deixe os campos em branco se não desejar alterar a senha atual.
          </p>
        </div>

        {/* Financeiro - Removido por ser Individual agora */}

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

          <h3 className="font-semibold text-text-primary text-sm mt-4">AtlasDao (Principal)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">API Key (AtlasDao)</label>
              <input type="password" value={configs['ATLASDAO_API_KEY'] || ''} onChange={(e) => handleChange('ATLASDAO_API_KEY', e.target.value)} className="input-field" placeholder="Sua chave..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Webhook Secret (AtlasDao)</label>
              <input type="password" value={configs['ATLASDAO_WEBHOOK_SECRET'] || ''} onChange={(e) => handleChange('ATLASDAO_WEBHOOK_SECRET', e.target.value)} className="input-field" placeholder="Segredo HMAC..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Endereço da Carteira (Wallet / DePix Address)</label>
              <input type="text" value={configs['ATLASDAO_WALLET_ADDRESS'] || ''} onChange={(e) => handleChange('ATLASDAO_WALLET_ADDRESS', e.target.value)} className="input-field" placeholder="Ex: 0x123... (Necessário para gerar QR Code)" />
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Telegram Bot Token</label>
              <input type="password" value={configs['TELEGRAM_BOT_TOKEN'] || ''} onChange={(e) => handleChange('TELEGRAM_BOT_TOKEN', e.target.value)} className="input-field" placeholder="Token do BotFather..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Telegram Chat ID (Seu ID ou do Grupo)</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input type="text" value={configs['TELEGRAM_CHAT_ID'] || ''} onChange={(e) => handleChange('TELEGRAM_CHAT_ID', e.target.value)} className="input-field flex-1" placeholder="Ex: 123456789" />
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch('/api/telegram/test', { method: 'POST' })
                      if (res.ok) {
                        showToast('Mensagem enviada com sucesso! Verifique seu Telegram.', 'success')
                      } else {
                        const errData = await res.json()
                        showToast(`Telegram respondeu: ${errData.error || 'Desconhecido'}`, 'error')
                      }
                    }}
                    className="btn-secondary px-4 text-xs font-semibold whitespace-nowrap"
                  >
                    Testar Bot
                  </button>
                </div>
                <p className="text-[10px] text-text-muted mt-1 leading-tight border-l-2 border-accent/50 pl-2">
                  <strong>IMPORTANTE:</strong> O Telegram bloqueia mensagens de Bots até que você inicie uma conversa com eles. Procure pelo seu Bot no aplicativo do Telegram e envie <strong>/start</strong> ou um "Oi" antes de testar a notificação!
                </p>
              </div>
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
