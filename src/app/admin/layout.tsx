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
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-white`}
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        {/* Logo / Header */}
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h1 className="font-extrabold text-[#1e293b] text-[17px] tracking-tight">Gestão de Empréstimos</h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-text-muted hover:text-text-primary">
            ✕
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-[#ecfdf5] text-[#059669]'
                    : 'text-[#475569] hover:bg-slate-50 hover:text-[#1e293b]'
                }`}
              >
                <span className={`text-xl ${active ? 'text-[#10b981]' : 'text-[#64748b] grayscale opacity-70'}`}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Exit Button at Bottom */}
        <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-3 w-full px-4 py-3 text-[#ef4444] hover:bg-red-50 rounded-xl transition-colors font-semibold text-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 bg-[#f8fafc]">
        {/* Top bar (Mobile toggle only mostly) */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-white lg:hidden border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
            <span className="font-bold text-slate-800">
              {navItems.find((i) => isActive(i.href))?.label || 'Gestão'}
            </span>
          </div>
          
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-bold">
            {user.name.charAt(0).toUpperCase()}
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
