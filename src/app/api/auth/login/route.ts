import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken } from '@/lib/auth'

// Simple in-memory rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000 // 1 minute

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const now = Date.now()
    const record = loginAttempts.get(ip)

    if (record) {
      if (now > record.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
      } else if (record.count >= MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000)
        return NextResponse.json(
          { error: `Muitas tentativas. Tente novamente em ${retryAfter}s.` },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        )
      } else {
        record.count++
      }
    } else {
      loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    }
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const cleanEmail = email.trim().toLowerCase()

    // Buscamos ignorando case
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cleanEmail,
          mode: 'insensitive'
        }
      }
    })
    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const valid = await comparePassword(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    })

    await prisma.log.create({
      data: {
        userId: user.id,
        acao: 'LOGIN',
        detalhes: `Login realizado por ${user.email}`,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
