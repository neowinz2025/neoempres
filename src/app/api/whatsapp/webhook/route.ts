import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

export async function GET() {
  return NextResponse.json({ 
    status: 'active', 
    message: 'Webhook do WhatsApp está funcionando corretamente. Aguardando conexões POST do W-API.' 
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    console.log('[WhatsApp Webhook] Received:', JSON.stringify(payload))

    // Tentativa robusta de encontrar o corpo da mensagem e o remetente
    // W-API ou instâncias similares podem enviar de formas variadas
    let body = ""
    let from = ""

    if (payload.data) {
      body = payload.data.body || payload.data.text || ""
      from = payload.data.from || payload.data.phone || ""
    } else if (payload.message) {
      body = payload.message.body || (payload.message.text ? payload.message.text.body : "") || ""
      from = payload.message.from || payload.message.phone || ""
    } else {
      body = payload.body || payload.text || ""
      from = payload.from || payload.phone || ""
    }

    body = body.toString().toLowerCase().trim()

    console.log(`[WhatsApp Webhook] Body: "${body}", From: "${from}"`)

    if (!body || !from) {
      console.log('[WhatsApp Webhook] Ignore: No body or from found')
      return NextResponse.json({ processed: false, reason: 'No message body or sender found' })
    }

    // Keyword detection
    const keywords = ['pix', 'chave', 'pagamento', 'pagar', 'pago', 'valor', 'conta']
    const matches = keywords.some(k => body.includes(k))

    console.log(`[WhatsApp Webhook] Keyword matches: ${matches}`)

    if (matches) {
      // Fetch configs including BASE_URL
      const configsDB = await prisma.config.findMany({
        where: {
          key: { in: ['PIX_PROVIDER', 'CHAVEPIX_CHAVE', 'CHAVEPIX_NOME', 'ATLASDAO_WALLET_ADDRESS', 'ATLASDAO_API_KEY', 'BASE_URL'] }
        }
      })

      const configs: Record<string, string> = {}
      configsDB.forEach(c => { configs[c.key] = c.value })

      const provider = configs['PIX_PROVIDER'] || 'atlasdao'
      const baseUrl = configs['BASE_URL'] || ''

      // Attempt to find client to provide portal link
      let portalLink = ''
      const phoneDigits = from.replace(/\D/g, '')
      const lastDigits = phoneDigits.slice(-8) // Match last 8 digits for robustness
      
      const cliente = await prisma.cliente.findFirst({
        where: {
          telefone: { contains: lastDigits }
        }
      })

      if (cliente && baseUrl) {
        portalLink = `\n\n🔗 *Seu Portal do Cliente:*\n${baseUrl}/cliente/${cliente.token}`
      }

      let pixInfo = ''

      if (provider === 'atlasdao') {
        pixInfo = `💠 *Informações para PIX (AtlasDAO):*\n\n*Carteira:* ${configs['ATLASDAO_WALLET_ADDRESS'] || 'Não configurada'}`
      } else if (provider === 'bitbridge') {
        pixInfo = `💠 *Informações para PIX (BitBridge):*\n\nUtilize o link de pagamento enviado na sua fatura para gerar o QR Code dinâmico.`
      } else if (provider === 'chavepix') {
        pixInfo = `💠 *Chave PIX:* ${configs['CHAVEPIX_CHAVE'] || 'Não configurada'}\n*Nome:* ${configs['CHAVEPIX_NOME'] || 'Não configurado'}`
      }

      if (pixInfo) {
        const responseMessage = `Olá${cliente ? ' ' + cliente.nome : ''}! 🤖 Identificamos que você solicitou informações de pagamento.\n\n${pixInfo}${portalLink}\n\nApós realizar o pagamento, por favor envie o comprovante por aqui.`
        
        console.log(`[WhatsApp Webhook] Attempting reply to ${from}...`)
        const ok = await sendWhatsApp(from, responseMessage)
        console.log(`[WhatsApp Webhook] Reply result: ${ok}`)
        
        return NextResponse.json({ processed: true, action: 'Replied with PIX info', success: ok })
      }
    }

    return NextResponse.json({ processed: false, reason: 'No keyword match' })
  } catch (error: any) {
    console.error('[WhatsApp Webhook Error]:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
