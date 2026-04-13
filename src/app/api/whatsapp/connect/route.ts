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
        key: { in: ['EVOLUTION_URL', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE'] },
      },
    })
    
    let baseUrl = ''
    let apiKey = ''
    let instanceName = ''

    dbConfigs.forEach((c) => {
      if (c.key === 'EVOLUTION_URL') baseUrl = c.value || ''
      if (c.key === 'EVOLUTION_API_KEY') apiKey = c.value || ''
      if (c.key === 'EVOLUTION_INSTANCE') instanceName = c.value || ''
    })

    if (!baseUrl || !apiKey || !instanceName) {
      return NextResponse.json({ error: 'Configurações do Evolution API não preenchidas no painel.' }, { status: 400 })
    }

    let cleanBaseUrl = baseUrl.replace(/\/$/, '')
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `http://${cleanBaseUrl}`
    }

    // 1. Opcional: verificar estado para criar a instância se não existir
    try {
      await fetch(`${cleanBaseUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: apiKey },
      })
    } catch {
      // Cria a instância caso ela não exista ainda
      await fetch(`${cleanBaseUrl}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      })
    }

    // 2. Tentar buscar conexão via Connect (Isso retorna o Base64 na v2)
    let qrcodeBase64 = null
    let stateData: any = { instance: { state: 'connecting' } }

    try {
      const connectRes = await fetch(`${cleanBaseUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: apiKey },
      })

      if (connectRes.ok) {
        const data = await connectRes.json()
        if (data.base64) {
          qrcodeBase64 = data.base64
        } else if (data.qrcode && data.qrcode.base64) {
          qrcodeBase64 = data.qrcode.base64
        } else if (typeof data.qrcode === 'string') {
          qrcodeBase64 = data.qrcode
        }
      } else {
        console.warn('[WhatsApp] /connect não retornou OK. Geralmente ocorre se a instância já estiver lida.')
      }
    } catch (e: any) {
      console.error('[WhatsApp] Falha ao tentar conectar:', e.message)
    }

    // Checa o state da conexão
    const stateRes = await fetch(`${cleanBaseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
    })
    
    if (stateRes.ok) {
      stateData = await stateRes.json()
    }

    return NextResponse.json({
      qrcode: qrcodeBase64,
      state: stateData.instance?.state || stateData.state || 'connecting'
    })

  } catch (error) {
    console.error('[WhatsApp Connect Error]:', error)
    return NextResponse.json({ error: 'Erro ao conectar à API do WhatsApp. Verifique as credenciais.' }, { status: 500 })
  }
}
