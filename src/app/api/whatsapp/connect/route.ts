import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const dbConfigs = await prisma.config.findMany({
      where: {
        key: { in: ['WAPI_INSTANCE_ID', 'WAPI_TOKEN'] },
      },
    })
    
    let instanceId = ''
    let token = ''

    dbConfigs.forEach((c) => {
      if (c.key === 'WAPI_INSTANCE_ID') instanceId = c.value || ''
      if (c.key === 'WAPI_TOKEN') token = c.value || ''
    })

    if (!instanceId || !token) {
      return NextResponse.json({ error: 'Preencha o Instance ID e o Token do W-API nas configurações.' }, { status: 400 })
    }

    const headers = {
      'Authorization': `Bearer ${token}`
    }

    let qrcodeBase64 = null
    let state = 'connecting'

    try {
      // 1. Get Instance Status
      const statusRes = await fetch(`https://api.w-api.app/v1/instance/status-instance?instanceId=${instanceId}`, { headers })
      if (statusRes.ok) {
        const statusData = await statusRes.json()
        // W-API return examples: { connected: true } or { state: 'CONNECTED' }
        if (statusData.connected === true || statusData.state === 'CONNECTED') {
          state = 'CONNECTED'
        } else {
          state = statusData.state || 'DISCONNECTED'
        }
      }

      // 2. If not connected, get QR Code
      if (state !== 'CONNECTED') {
        const qrRes = await fetch(`https://api.w-api.app/v1/instance/qr-code?instanceId=${instanceId}`, { headers })
        if (qrRes.ok) {
          const qrData = await qrRes.json()
          if (qrData.qrcode) {
            qrcodeBase64 = qrData.qrcode
          } else if (qrData.base64) {
             qrcodeBase64 = qrData.base64
          }
        }
      }
    } catch (e: any) {
      console.error('[WhatsApp] W-API connection failure:', e.message)
      state = 'Erro de Servidor Inalcançável'
    }

    return NextResponse.json({
      qrcode: qrcodeBase64,
      state: state
    })

  } catch (error) {
    console.error('[WhatsApp Connect Error]:', error)
    return NextResponse.json({ error: 'Erro ao comunicar com o W-API.' }, { status: 500 })
  }
}

