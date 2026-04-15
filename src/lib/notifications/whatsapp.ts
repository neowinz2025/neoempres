import { prisma } from '../prisma'

export async function sendWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const configsDB = await prisma.config.findMany({
    where: { 
      key: { in: ['WAPI_ENABLED', 'WAPI_INSTANCE_ID', 'WAPI_TOKEN'] }
    }
  })

  let wapiEnabled = false
  let instanceId = ''
  let token = ''

  for (const c of configsDB) {
    if (c.key === 'WAPI_ENABLED') wapiEnabled = c.value === 'true'
    if (c.key === 'WAPI_INSTANCE_ID') instanceId = c.value || ''
    if (c.key === 'WAPI_TOKEN') token = c.value || ''
  }

  if (!wapiEnabled || !instanceId || !token) {
    console.warn('[WhatsApp] W-API not configured or disabled in DB')
    return false
  }

  try {
    let phone = telefone.replace(/\D/g, '')
    
    // Remove zero à esquerda se houver (ex: 011...)
    if (phone.startsWith('0')) {
      phone = phone.substring(1)
    }

    // Se tiver 10 ou 11 dígitos (DDD + número), adiciona o prefixo 55
    if (phone.length === 10 || phone.length === 11) {
      phone = `55${phone}`
    }

    // W-API: POST /message/send-text?instanceId={ID}
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        phone,
        message: mensagem
      }),
    })

    if (!res.ok) {
      console.error('[WhatsApp] W-API Error:', await res.text())
      return false
    }

    const data = await res.json()
    // W-API pode retornar messageId, id, key ou result
    const success = !!(data.messageId || data.id || data.key || data.result)
    if (!success) console.warn('[WhatsApp] W-API Success Key not found in:', JSON.stringify(data))
    return success
  } catch (error) {
    console.error('[WhatsApp] W-API Error:', error)
    return false
  }
}

