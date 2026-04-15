import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    console.log('[WhatsApp Webhook] Received:', JSON.stringify(payload))

    // Note: W-API payload structure can vary, but usually has message.body and message.from
    // or data.body and data.from for 'received_message' type
    const messageData = payload.data || payload.message || payload
    const body = (messageData.body || messageData.text || '').toString().toLowerCase()
    const from = messageData.from || messageData.sender || messageData.phone

    if (!body || !from) {
      return NextResponse.json({ processed: false, reason: 'No message body or sender found' })
    }

    // Keyword detection
    const keywords = ['pix', 'chave', 'pagamento', 'pagar', 'pago']
    const matches = keywords.some(k => body.includes(k))

    if (matches) {
      // Fetch PIX configs
      const configsDB = await prisma.config.findMany({
        where: {
          key: { in: ['PIX_PROVIDER', 'CHAVEPIX_CHAVE', 'CHAVEPIX_NOME', 'ATLASDAO_WALLET_ADDRESS', 'ATLASDAO_API_KEY'] }
        }
      })

      const configs: Record<string, string> = {}
      configsDB.forEach(c => { configs[c.key] = c.value })

      const provider = configs['PIX_PROVIDER'] || 'atlasdao'
      let pixInfo = ''

      if (provider === 'atlasdao') {
        pixInfo = `💠 *Informações para PIX (AtlasDAO):*\n\n*Carteira:* ${configs['ATLASDAO_WALLET_ADDRESS'] || 'Não configurada'}`
      } else if (provider === 'bitbridge') {
        pixInfo = `💠 *Informações para PIX (BitBridge):*\n\nUtilize o link de pagamento enviado na sua fatura para gerar o QR Code dinâmico.`
      } else if (provider === 'chavepix') {
        pixInfo = `💠 *Chave PIX:* ${configs['CHAVEPIX_CHAVE'] || 'Não configurada'}\n*Nome:* ${configs['CHAVEPIX_NOME'] || 'Não configurado'}`
      }

      if (pixInfo) {
        const responseMessage = `Olá! 🤖 Identificamos que você solicitou informações de pagamento.\n\n${pixInfo}\n\nApós realizar o pagamento, por favor envie o comprovante por aqui.`
        
        await sendWhatsApp(from, responseMessage)
        return NextResponse.json({ processed: true, action: 'Replied with PIX info' })
      }
    }

    return NextResponse.json({ processed: false, reason: 'No keyword match' })
  } catch (error: any) {
    console.error('[WhatsApp Webhook Error]:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
