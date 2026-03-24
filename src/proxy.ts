import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set!')
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || ''
)

const publicPaths = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/webauthn/login',
  '/api/webhook',
  '/api/icon',
  '/api/cron',
  '/cliente',
]

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  return response
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Allow static assets
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
      return addSecurityHeaders(NextResponse.next())
    } catch {
      // Clear invalid cookie
      const response = pathname.startsWith('/api')
        ? NextResponse.json({ error: 'Token inválido' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('auth-token')
      return response
    }
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
