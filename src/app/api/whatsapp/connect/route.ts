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
      return NextResponse.json({ error: 'Preencha a URL, a API Key e o Nome da Instância para gerar o QR Code.' }, { status: 400 })
    }

    let cleanBaseUrl = baseUrl.replace(/\/$/, '')
    // Se colaram só o domínio
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `https://${cleanBaseUrl}`
    }

    // Se no endpoint eles colaram um `/message/sendText/...` , nós pegamos apenas a raiz da url
    try {
      const urlObj = new URL(cleanBaseUrl)
      cleanBaseUrl = urlObj.origin
    } catch {}

    const isUazapi = cleanBaseUrl.toLowerCase().includes('uazapi')

    let qrcodeBase64 = null
    let stateData: any = { instance: { state: 'connecting' } }

    try {
      if (isUazapi) {
        // UaZapi usa POST para conectar e GET para status (que inclui o qrcode)
        await fetch(`${cleanBaseUrl}/instance/connect`, {
          method: 'POST',
          headers: { token: apiKey, apikey: apiKey }
        })
        
        const stateRes = await fetch(`${cleanBaseUrl}/instance/status`, {
          headers: { token: apiKey, apikey: apiKey }
        })
        
        if (stateRes.ok) {
           const data = await stateRes.json()
           stateData = data
           // Pega o QrCode base64
           if (data.qrcode) qrcodeBase64 = data.qrcode
           if (data.base64) qrcodeBase64 = data.base64
        } else {
           const errData = await stateRes.json().catch(()=>({}))
           stateData = { state: `Erro ${stateRes.status}: ${errData.message || 'Falha na Autenticação (Token Inválido?)'}` }
        }
      } else {
        // Padrão Evolution
        const connectRes = await fetch(`${cleanBaseUrl}/instance/connect/${instanceName}`, {
          headers: { apikey: apiKey, 'Authorization': `Bearer ${apiKey}` },
        })

        if (connectRes.ok) {
          const data = await connectRes.json()
          if (data.base64) qrcodeBase64 = data.base64
          else if (data.qrcode && data.qrcode.base64) qrcodeBase64 = data.qrcode.base64
          else if (typeof data.qrcode === 'string') qrcodeBase64 = data.qrcode
        }

        const stateRes = await fetch(`${cleanBaseUrl}/instance/connectionState/${instanceName}`, {
          headers: { apikey: apiKey, 'Authorization': `Bearer ${apiKey}` },
        })
        if (stateRes.ok) {
          stateData = await stateRes.json()
        } else {
          stateData = { state: `Erro ${stateRes.status}: Falha ao conectar. Verifique Base URL e Nome da Instância.` }
        }
      }
    } catch (e: any) {
      console.error('[WhatsApp] Falha ao tentar conectar:', e.message)
      stateData = { state: 'Erro de Servidor Inalcançável' }
    }

    const currentState = stateData.instance?.state || stateData.state || stateData.status || 'connecting'

    return NextResponse.json({
      qrcode: qrcodeBase64,
      state: currentState
    })

  } catch (error) {
    console.error('[WhatsApp Connect Error]:', error)
    return NextResponse.json({ error: 'Erro ao comunicar com a API provedora.' }, { status: 500 })
  }
}
