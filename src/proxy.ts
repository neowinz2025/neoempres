import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
)

const publicPaths = ['/login', '/api/auth/login', '/api/webhook', '/cliente']

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Allow static assets and api docs
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icons') ||
    pathname === '/'
  ) {
    return NextResponse.next()
  }

  // Check auth for admin routes and API
  if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
      await jwtVerify(token, JWT_SECRET)
      return NextResponse.next()
    } catch {
      if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
