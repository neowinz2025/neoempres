'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface User {
  name: string
  email: string
  role: string
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/clientes', label: 'Clientes', icon: '👥' },
  { href: '/admin/emprestimos', label: 'Empréstimos', icon: '💰' },
  { href: '/admin/calculadora', label: 'Calculadora', icon: '🧮' },
  { href: '/admin/relatorios', label: 'Relatórios', icon: '📈' },
  { href: '/admin/configuracoes', label: 'Configurações', icon: '⚙️' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router])

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }, [router])

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--color-bg-secondary)', borderRight: '1px solid var(--color-border)' }}
      >
        {/* Logo */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 p-1">
            <img src="/api/icon" alt="Logo" className="w-full h-full object-contain rounded-lg drop-shadow-sm" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-text-primary">LoanPro</h1>
            <p className="text-xs text-text-muted">Gestão Financeira</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive(item.href)
                  ? 'text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
              }`}
              style={isActive(item.href) ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.1))', color: '#818cf8' } : {}}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
              {isActive(item.href) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#818cf8' }} />
              )}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-text-primary truncate">{user.name}</p>
              <p className="text-xs text-text-muted truncate">{user.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary w-full justify-center text-xs py-2">
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 h-14" style={{ background: 'rgba(10,14,26,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>

          <div className="hidden lg:flex items-center gap-2 text-sm text-text-muted">
            {navItems.find((i) => isActive(i.href))?.icon}{' '}
            {navItems.find((i) => isActive(i.href))?.label || 'LoanPro'}
          </div>

          <div className="flex items-center gap-2">
            <span className="badge badge-accent text-xs">{user.role}</span>
          </div>
        </header>

        {/* Page content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
