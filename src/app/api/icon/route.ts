import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const config = await prisma.config.findUnique({ where: { key: 'APP_LOGO' } })
    
    if (config?.value && config.value.startsWith('data:image/')) {
      const parts = config.value.split(',')
      const mime = parts[0].split(':')[1].split(';')[0]
      const base64 = parts[1]
      const buffer = Buffer.from(base64, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=60',
        },
      })
    }
    
    // Default SVG
    const defaultSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>`
    
    return new NextResponse(defaultSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    return new NextResponse('Error', { status: 500 })
  }
}
