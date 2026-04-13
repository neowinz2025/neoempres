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

    const cleanBaseUrl = baseUrl.replace(/\/$/, '')

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
    const connectRes = await fetch(`${cleanBaseUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: apiKey },
    })

    if (!connectRes.ok) {
      throw new Error('Falha ao comunicar com Evolution API para conectar')
    }

    const data = await connectRes.json()
    
    // Na v1/v2, o base64 geralmente retorna em data.base64 ou data.qrcode.base64
    let qrcodeBase64 = null
    if (data.base64) {
      qrcodeBase64 = data.base64
    } else if (data.qrcode && data.qrcode.base64) {
      qrcodeBase64 = data.qrcode.base64
    } else if (data.qrcode) {
      // Às vezes retorna o Base64 puro no qrcode
      qrcodeBase64 = data.qrcode
    }

    // Checa o state da conexão
    const stateRes = await fetch(`${cleanBaseUrl}/instance/connectionState/${instanceName}`, {
      headers: { apikey: apiKey },
    })
    
    let stateData = { instance: { state: 'connecting' } }
    if (stateRes.ok) {
      stateData = await stateRes.json()
    }

    return NextResponse.json({
      qrcode: qrcodeBase64,
      state: stateData.instance?.state || 'connecting'
    })

  } catch (error) {
    console.error('[WhatsApp Connect Error]:', error)
    return NextResponse.json({ error: 'Erro ao conectar à API do WhatsApp. Verifique as credenciais.' }, { status: 500 })
  }
}
