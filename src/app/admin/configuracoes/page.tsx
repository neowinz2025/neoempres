'use client'

import { useState, useEffect, useCallback } from 'react'

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingBot, setTestingBot] = useState(false)
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  // Read theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved) setTheme(saved)
  }, [])

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  }, [theme])

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
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      {/* Toast Notification */}
      {toastMsg && (
        <div 
          className={`fixed left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[9999] px-4 py-3 rounded-xl shadow-lg border text-white text-sm font-medium text-center transition-all ${toastType === 'success' ? 'bg-[#10b981] border-[#059669]' : 'bg-[#ef4444] border-[#dc2626]'}`}
          style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
        >
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Configurações Gerais</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie chaves de API, notificações e integrações do sistema</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* TEMA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                <span className="text-xl">{theme === 'dark' ? '🌙' : '☀️'}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Tema do Sistema</h2>
                <p className="text-sm text-slate-500">Alternar entre tema claro e escuro</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Claro</span>
              <button
                type="button"
                onClick={toggleTheme}
                className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer border-2 ${theme === 'dark' ? 'bg-[#6366f1] border-[#6366f1]' : 'bg-slate-200 border-slate-200'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'right-0.5' : 'left-0.5'}`} />
              </button>
              <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-700' : 'text-slate-400'}`}>Escuro</span>
            </div>
          </div>
        </div>
        
        {/* LOGO DO SISTEMA */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
              <span className="text-xl">🖼️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Logo do Sistema</h2>
              <p className="text-sm text-slate-500">Exibida na tela de login e ícone do app instalado</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-28 h-28 rounded-2xl border-2 border-slate-100 flex items-center justify-center bg-slate-50 overflow-hidden flex-shrink-0 shadow-inner">
              {configs['APP_LOGO'] ? (
                <img src={configs['APP_LOGO']} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <label className="cursor-pointer bg-[#10b981] hover:bg-[#059669] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-flex items-center gap-2 w-max shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Trocar logo
                <input 
                  type="file" 
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.size > 1024 * 1024) return showToast('A logo deve ter no máximo 1MB.', 'error')
                      const reader = new FileReader()
                      reader.onload = (ev) => handleChange('APP_LOGO', ev.target?.result as string)
                      reader.readAsDataURL(file)
                    }
                  }}
                />
              </label>
              <p className="text-xs text-slate-500">PNG, JPG, WebP ou SVG. Máximo 1MB.</p>
              {configs['APP_LOGO'] && (
                <button type="button" onClick={() => handleChange('APP_LOGO', '')} className="text-[#ef4444] text-sm font-semibold flex items-center gap-1.5 w-max hover:underline mt-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Remover logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PIX */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
              <span className="text-xl">⚙️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Configurações de Pagamentos PIX</h2>
              <p className="text-sm text-slate-500">Configure sua API de pagamentos</p>
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Selecione a API PIX</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* AtlasDAO */}
              <button
                type="button"
                onClick={() => handleChange('PIX_PROVIDER', 'atlasdao')}
                className={`relative text-left border-2 rounded-xl p-4 transition-all cursor-pointer ${
                  (configs['PIX_PROVIDER'] || 'atlasdao') === 'atlasdao'
                    ? 'border-[#10b981] bg-[#ecfdf5]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                {(configs['PIX_PROVIDER'] || 'atlasdao') === 'atlasdao' && (
                  <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#10b981] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
                <h3 className="font-bold text-slate-800 text-[15px]">DEPIX (AtlasDAO)</h3>
                <p className="text-xs text-slate-600 mt-1">API via AtlasDAO Web3</p>
              </button>

              {/* BitBridge */}
              <button
                type="button"
                onClick={() => handleChange('PIX_PROVIDER', 'bitbridge')}
                className={`relative text-left border-2 rounded-xl p-4 transition-all cursor-pointer ${
                  configs['PIX_PROVIDER'] === 'bitbridge'
                    ? 'border-[#10b981] bg-[#ecfdf5]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                {configs['PIX_PROVIDER'] === 'bitbridge' && (
                  <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#10b981] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
                <h3 className="font-bold text-slate-800 text-[15px]">BitBridge</h3>
                <p className="text-xs text-slate-600 mt-1">API DePix via BitBridge</p>
              </button>

              {/* Chave PIX */}
              <button
                type="button"
                onClick={() => handleChange('PIX_PROVIDER', 'chavepix')}
                className={`relative text-left border-2 rounded-xl p-4 transition-all cursor-pointer ${
                  configs['PIX_PROVIDER'] === 'chavepix'
                    ? 'border-[#10b981] bg-[#ecfdf5]'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                {configs['PIX_PROVIDER'] === 'chavepix' && (
                  <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-[#10b981] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}
                <h3 className="font-bold text-slate-800 text-[15px]">Chave PIX</h3>
                <p className="text-xs text-slate-600 mt-1">QR code pela sua chave PIX</p>
              </button>
            </div>
          </div>

          {/* AtlasDAO fields */}
          {(configs['PIX_PROVIDER'] || 'atlasdao') === 'atlasdao' && (
            <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">AtlasDAO API Key <span className="text-red-500">*</span></label>
                <input type="password" value={configs['ATLASDAO_API_KEY'] || ''} onChange={(e) => handleChange('ATLASDAO_API_KEY', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all placeholder:text-slate-400" placeholder="••••••••••••••••••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">DEPIX Wallet Address <span className="text-red-500">*</span></label>
                <input type="text" value={configs['ATLASDAO_WALLET_ADDRESS'] || ''} onChange={(e) => handleChange('ATLASDAO_WALLET_ADDRESS', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 font-mono focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all placeholder:text-slate-400" placeholder="0x..." />
                <p className="text-xs text-slate-500 mt-1.5 ml-1">Endereço da sua carteira para receber os pagamentos</p>
              </div>
              <div className="mt-5 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4">
                <h4 className="font-bold text-[#1e40af] text-sm mb-2">Informações Importantes</h4>
                <ul className="list-disc list-inside text-xs text-[#1e3a8a] space-y-1">
                  <li>As credenciais são armazenadas de forma segura.</li>
                  <li>A API Key e o endereço são obrigatórios para gerar cobranças PIX.</li>
                  <li>Todos os pagamentos serão recebidos no endereço configurado.</li>
                </ul>
              </div>
            </div>
          )}

          {/* BitBridge fields */}
          {configs['PIX_PROVIDER'] === 'bitbridge' && (
            <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">BitBridge API Key <span className="text-red-500">*</span></label>
                <input type="password" value={configs['BITBRIDGE_API_KEY'] || ''} onChange={(e) => handleChange('BITBRIDGE_API_KEY', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all placeholder:text-slate-400" placeholder="bpk_••••••••••••••••••••••" />
                <p className="text-xs text-slate-500 mt-1.5 ml-1">Obtenha sua key no painel BitBridge (formato <code className="bg-slate-100 px-1 rounded">bpk_...</code>)</p>
              </div>
              <div className="mt-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-4">
                <h4 className="font-bold text-[#1e40af] text-sm mb-2">Sobre o BitBridge</h4>
                <ul className="list-disc list-inside text-xs text-[#1e3a8a] space-y-1">
                  <li>Endpoint: <code className="bg-white px-1 rounded">depix-create-pix</code> via Supabase Functions.</li>
                  <li>Limite por operação: R$ 500,00 &mdash; Volume diário: R$ 5.000,00.</li>
                  <li>Mínimo aceito: R$ 20,00 (2000 centavos).</li>
                </ul>
              </div>
            </div>
          )}

          {/* Chave PIX fields */}
          {configs['PIX_PROVIDER'] === 'chavepix' && (
            <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Chave PIX <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={configs['CHAVEPIX_CHAVE'] || ''}
                    onChange={(e) => handleChange('CHAVEPIX_CHAVE', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all"
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  />
                  <p className="text-xs text-slate-500 mt-1.5 ml-1">Informe qualquer tipo de chave PIX cadastrada no seu banco.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Favorecido <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    maxLength={25}
                    value={configs['CHAVEPIX_NOME'] || ''}
                    onChange={(e) => handleChange('CHAVEPIX_NOME', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all"
                    placeholder="Ex: JOAO SILVA"
                  />
                  <p className="text-xs text-slate-500 mt-1.5 ml-1">Máx. 25 caracteres, sem acentos.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cidade <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    maxLength={15}
                    value={configs['CHAVEPIX_CIDADE'] || ''}
                    onChange={(e) => handleChange('CHAVEPIX_CIDADE', e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all"
                    placeholder="Ex: SAO PAULO"
                  />
                  <p className="text-xs text-slate-500 mt-1.5 ml-1">Máx. 15 caracteres, sem acentos.</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-bold text-amber-800 text-sm mb-1.5">⚠️ Confirmação Manual</h4>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Com Chave PIX, o QR code é gerado automaticamente mas <strong>a baixa da parcela não é automática</strong>.
                  Após confirmar o pagamento no seu banco, registre manualmente no painel em <strong>Empréstimos → Parcela → Receber</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notificações via Z-API */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center border border-green-100">
                <span className="text-xl">💬</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Cobrança via WhatsApp (Z-API)</h2>
                <p className="text-sm text-slate-500">Envie cobranças automaticamente pelo WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {configs['ZAPI_ENABLED'] === 'true' ? (
                <button type="button" onClick={() => handleChange('ZAPI_ENABLED', 'false')} className="w-11 h-6 bg-[#0284c7] rounded-full relative transition-colors cursor-pointer border-2 border-[#0284c7]">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full"></div>
                </button>
              ) : (
                <button type="button" onClick={() => handleChange('ZAPI_ENABLED', 'true')} className="w-11 h-6 bg-slate-200 rounded-full relative transition-colors cursor-pointer border-2 border-slate-200">
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full"></div>
                </button>
              )}
              <span className={`text-sm font-semibold ${configs['ZAPI_ENABLED'] === 'true' ? 'text-[#0284c7]' : 'text-slate-500'}`}>
                {configs['ZAPI_ENABLED'] === 'true' ? 'Ativado' : 'Desativado'}
              </span>
            </div>
          </div>

          <div className={`mt-6 space-y-4 ${configs['ZAPI_ENABLED'] !== 'true' && 'opacity-50 pointer-events-none'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Instance ID</label>
                <input type="text" value={configs['ZAPI_INSTANCE_ID'] || ''} onChange={(e) => handleChange('ZAPI_INSTANCE_ID', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none" placeholder="Ex: 3B4E..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Z-API Token</label>
                <input type="password" value={configs['ZAPI_TOKEN'] || ''} onChange={(e) => handleChange('ZAPI_TOKEN', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none" placeholder="••••••••••••••••••••" />
              </div>
            </div>
          </div>
        </div>

        {/* Notificações via Telegram */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
           <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                <span className="text-xl">🔔</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Notificações via Telegram</h2>
                <p className="text-sm text-slate-500">Receba painéis de alerta e resumos diários</p>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 bg-[#f8fafc] rounded-xl p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Bot Token <span className="text-red-500">*</span></label>
                <input type="password" value={configs['TELEGRAM_BOT_TOKEN'] || ''} onChange={(e) => handleChange('TELEGRAM_BOT_TOKEN', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all" placeholder="••••••••••••••••••••••••" />
                <p className="text-xs text-slate-500 mt-1.5 ml-1">Obtido com @BotFather no Telegram</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Chat ID <span className="text-red-500">*</span></label>
                <input type="text" value={configs['TELEGRAM_CHAT_ID'] || ''} onChange={(e) => handleChange('TELEGRAM_CHAT_ID', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 font-mono focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all" placeholder="12345678" />
                <p className="text-xs text-slate-500 mt-1.5 ml-1">Seu ID Pessoal (use @userinfobot)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dias de Antecedência para Lembrete</label>
              <input type="number" min="0" value={configs['DIAS_ANTECEDENCIA_LEMBRETE'] || '1'} onChange={(e) => handleChange('DIAS_ANTECEDENCIA_LEMBRETE', e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none" />
              <p className="text-xs text-slate-400 mt-1.5 ml-1">0 = no dia do vencimento, 1 = 1 dia antes, etc.</p>
            </div>

            {/* Como configurar Telegram Box */}
            <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-5">
              <h4 className="font-bold text-[#1e3a8a] text-sm mb-3">Como configurar</h4>
              <ol className="list-decimal list-inside text-[13px] text-[#1e3a8a] space-y-2">
                <li>Abra o Telegram e converse com <strong className="font-semibold">@BotFather</strong></li>
                <li>Envie <code className="bg-white px-1 py-0.5 rounded text-xs text-[#0369a1]">/newbot</code> e siga as instruções para criar um bot</li>
                <li>Copie o Token fornecido pelo BotFather</li>
                <li>Inicie uma conversa com seu bot e envie uma mensagem como "oi"</li>
                <li>Use <strong className="font-semibold">@userinfobot</strong> para descobrir seu Chat ID</li>
              </ol>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={testingBot}
                onClick={async () => {
                  setTestingBot(true)
                  try {
                    // First run diagnostic to check state
                    const diagRes = await fetch('/api/telegram/diagnostico')
                    const diagData = await diagRes.json()
                    const diag = diagData.data

                    if (diag?.tokenCorrupted || diag?.chatCorrupted) {
                      showToast('⚠️ Token ou Chat ID corrompido no banco. Reinsira os valores e salve antes de testar.', 'error')
                      setTestingBot(false)
                      return
                    }

                    if (!diag?.hasToken || !diag?.hasChat) {
                      showToast('Token ou Chat ID não configurado. Preencha os campos e salve.', 'error')
                      setTestingBot(false)
                      return
                    }

                    if (diag?.apiStatus === 'INVALID_TOKEN') {
                      showToast(`Token inválido na API do Telegram: ${diag.apiError}`, 'error')
                      setTestingBot(false)
                      return
                    }

                    // Actually send test message
                    const res = await fetch('/api/telegram/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        botToken: configs['TELEGRAM_BOT_TOKEN']?.includes('•') ? undefined : configs['TELEGRAM_BOT_TOKEN'],
                        chatId: configs['TELEGRAM_CHAT_ID']?.includes('•') ? undefined : configs['TELEGRAM_CHAT_ID'],
                      })
                    })
                    if (res.ok) {
                      showToast('✅ Mensagem enviada! Verifique seu Telegram.', 'success')
                    } else {
                      const errData = await res.json().catch(() => ({ error: 'Resposta inválida.' }))
                      showToast(`Falha: ${errData.error}`, 'error')
                    }
                  } catch {
                    showToast('Erro de rede: falha na conexão.', 'error')
                  } finally {
                    setTestingBot(false)
                  }
                }}
                className="flex-1 bg-white border border-[#0284c7] text-[#0284c7] hover:bg-[#f0f9ff] py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                {testingBot ? 'Testando...' : 'Testar Conexão'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/telegram/diagnostico')
                    const data = await res.json()
                    const d = data.data
                    if (!d) { showToast('Erro ao buscar diagnóstico.', 'error'); return }

                    const lines = [
                      `Token: ${d.hasToken ? (d.tokenCorrupted ? '⚠️ CORROMPIDO — reinsira' : '✅ OK') : '❌ Ausente'}`,
                      `Chat ID: ${d.hasChat ? (d.chatCorrupted ? '⚠️ CORROMPIDO — reinsira' : `✅ ${d.chatId}`) : '❌ Ausente'}`,
                      `API: ${d.apiStatus === 'OK' ? '✅ Conectado' : d.apiStatus === 'INVALID_TOKEN' ? '❌ Token inválido' : d.apiStatus}`,
                    ]
                    if (d.apiError) lines.push(`Erro: ${d.apiError}`)
                    showToast(lines.join(' | '), d.apiStatus === 'OK' && d.hasToken && d.hasChat ? 'success' : 'error')
                  } catch {
                    showToast('Erro ao buscar diagnóstico.', 'error')
                  }
                }}
                className="bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors"
              >
                🔍 Diagnóstico
              </button>
            </div>

            {/* Aviso se o token pode estar corrompido */}
            {(configs['TELEGRAM_BOT_TOKEN']?.includes('•') || configs['TELEGRAM_CHAT_ID']?.includes('•')) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-medium">
                ⚠️ <strong>Atenção:</strong> O campo do Token ou Chat ID contém um valor mascarado (●●●●). Isso provavelmente significa que o valor real foi salvo corretamente. Clique em <strong>Diagnóstico</strong> para verificar o status real da conexão, ou reinsira seus valores e salve novamente.
              </div>
            )}
          </div>
        </div>

        {/* Security / Password Change */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100">
              <span className="text-xl">🔒</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Segurança</h2>
              <p className="text-sm text-slate-500">Altere sua senha de acesso ao sistema</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nova Senha</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar Nova Senha</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981] outline-none transition-all" placeholder="••••••••" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 ml-1">A senha deve ter no mínimo 6 caracteres. Deixe vazio para não alterar.</p>

          {/* Biometric Registration */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-2">Login com Biometria</h3>
            <p className="text-xs text-slate-500 mb-3">Registre sua biometria (Touch ID, Face ID ou leitor digital) para fazer login sem senha.</p>
            <button
              type="button"
              onClick={async () => {
                try {
                  // Check if WebAuthn is supported
                  if (!window.PublicKeyCredential) {
                    showToast('WebAuthn não suportado neste navegador. Use Safari no iPhone.', 'error')
                    return
                  }
                  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
                  if (!available) {
                    showToast('Biometria não disponível neste dispositivo.', 'error')
                    return
                  }

                  const optRes = await fetch('/api/auth/webauthn/register')
                  if (!optRes.ok) {
                    const errData = await optRes.json().catch(() => ({}))
                    showToast(errData.error || `Erro do servidor (${optRes.status})`, 'error')
                    return
                  }
                  const { options } = await optRes.json()
                  
                  const { startRegistration } = await import('@simplewebauthn/browser')
                  const regResp = await startRegistration({ optionsJSON: options })
                  
                  const verifyRes = await fetch('/api/auth/webauthn/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(regResp),
                  })
                  if (verifyRes.ok) {
                    showToast('✅ Biometria registrada! Use "Face ID / Biometria" no login.', 'success')
                  } else {
                    const e = await verifyRes.json()
                    showToast(e.error || 'Erro ao verificar registro', 'error')
                  }
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : String(err)
                  console.error('WebAuthn registration error:', err)
                  if (msg.includes('AbortError') || msg.includes('NotAllowedError') || msg.includes('cancelled')) {
                    showToast('Registro cancelado pelo usuário', 'error')
                  } else {
                    showToast(`Erro: ${msg}`, 'error')
                  }
                }
              }}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors inline-flex items-center gap-2"
            >
              🔐 Registrar Biometria
            </button>
          </div>
        </div>

        {/* Fixated Salvar Button */}
        <div className="sticky bottom-0 bg-[#f8fafc] pt-2 pb-6 z-10 w-full mt-8">
          <button type="submit" disabled={saving} className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white rounded-xl py-3.5 text-[15px] font-bold shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2">
            {saving ? 'Aplicando Configurações...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  )
}
