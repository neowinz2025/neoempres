'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [webauthnSupported, setWebauthnSupported] = useState(false)

  useEffect(() => {
    // Check WebAuthn support on client side only
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setWebauthnSupported(available))
        .catch(() => setWebauthnSupported(false))
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login')
        return
      }

      router.push('/admin')
    } catch {
      setError('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const handleBiometricLogin = async () => {
    setError('')
    setLoading(true)
    try {
      // 1. Get authentication options from server
      const optRes = await fetch('/api/auth/webauthn/login')
      if (!optRes.ok) {
        const e = await optRes.json()
        setError(e.error || 'Nenhuma biometria registrada. Faça login com senha e registre nas Configurações.')
        setLoading(false)
        return
      }
      const { options } = await optRes.json()
      
      // 2. Start browser WebAuthn authentication (Face ID / Touch ID)
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const authResp = await startAuthentication({ optionsJSON: options })
      
      // 3. Send response to server for verification
      const verifyRes = await fetch('/api/auth/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResp),
      })
      if (verifyRes.ok) {
        router.push('/admin')
      } else {
        const e = await verifyRes.json()
        setError(e.error || 'Falha na autenticação biométrica')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('cancelled') || message.includes('AbortError') || message.includes('NotAllowedError')) {
        setError('Autenticação cancelada pelo usuário')
      } else {
        setError(`Erro na biometria: ${message || 'Tente novamente'}`)
        console.error('WebAuthn error:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at top, #111827 0%, #0a0e1a 70%)' }}>
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />
      </div>

      <div className="w-full max-w-md animate-in relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-24 h-24 mb-4 pulse-glow">
            <img src="/api/icon" alt="LoanPro Logo" className="w-full h-full object-contain drop-shadow-xl rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">LoanPro</h1>
          <p className="text-text-muted mt-2 text-sm">Gestão de Empréstimos Pessoais</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">Entrar no Sistema</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium" style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Usuário ou Email</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="Seu usuário de acesso"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Biometric login button - only shows after client-side check */}
          {webauthnSupported && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full mt-3 py-3 border border-gray-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/5 transition-colors disabled:opacity-50"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              🔐 Entrar com Face ID / Biometria
            </button>
          )}
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          © 2026 LoanPro • Sistema de Gestão de Empréstimos
        </p>
      </div>
    </div>
  )
}
