'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Check if authenticated, redirect accordingly
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) {
          router.replace('/admin')
        } else {
          router.replace('/login')
        }
      })
      .catch(() => router.replace('/login'))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-text-secondary">Carregando...</span>
      </div>
    </div>
  )
}
