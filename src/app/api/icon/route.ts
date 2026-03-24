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
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    
    // Default SVG icon - emerald green with dollar sign
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="80" fill="#10b981"/>
      <text x="256" y="380" font-family="Arial,sans-serif" font-size="350" font-weight="bold" fill="white" text-anchor="middle">$</text>
    </svg>`
    
    return new NextResponse(defaultSvg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    return new NextResponse('Error', { status: 500 })
  }
}
