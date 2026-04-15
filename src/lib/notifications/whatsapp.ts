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
    const phone = telefone.replace(/\D/g, '')
    
    // W-API: POST /message/send-text?instanceId={ID}
    // Auth: Bearer {TOKEN}
    const endpoint = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        phone: phone.startsWith('55') ? phone : `55${phone}`, // Garante prefixo 55
        message: mensagem
      }),
    })

    if (!res.ok) {
      console.error('[WhatsApp] W-API Error:', await res.text())
      return false
    }

    const data = await res.json()
    return !!data.messageId // W-API retorna messageId em caso de sucesso
  } catch (error) {
    console.error('[WhatsApp] W-API Error:', error)
    return false
  }
}

