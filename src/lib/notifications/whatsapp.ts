import { prisma } from '../prisma'

export async function sendWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const configsDB = await prisma.config.findMany({
    where: { 
      key: { in: ['EVOLUTION_ENABLED', 'EVOLUTION_URL', 'EVOLUTION_API_KEY'] }
    }
  })

  let evolutionEnabled = false
  let baseUrl = ''
  let apiKey = ''
  const instanceName = 'neoempres'

  for (const c of configsDB) {
    if (c.key === 'EVOLUTION_ENABLED') evolutionEnabled = c.value === 'true'
    if (c.key === 'EVOLUTION_URL') baseUrl = c.value || ''
    if (c.key === 'EVOLUTION_API_KEY') apiKey = c.value || ''
  }

  if (!evolutionEnabled || !baseUrl || !apiKey) {
    console.warn('[WhatsApp] API not configured or disabled in DB')
    return false
  }

  try {
    const phone = telefone.replace(/\D/g, '')

    // Se o usuário colocou o endpoint original de API SaaS tipo Z-API ou UaZapi completo, ele usará direto.
    // Se não, no fallback assumimos padrão sendText
    let endpoint = baseUrl.trim()
    const isUazapi = endpoint.toLowerCase().includes('uazapi')

    if (!endpoint.toLowerCase().includes('sendtext') && !endpoint.toLowerCase().includes('send-text') && !endpoint.toLowerCase().includes('send/text')) {
       if (isUazapi) {
         endpoint = `${endpoint.replace(/\/$/, '')}/send/text`
       } else {
         endpoint = `${endpoint.replace(/\/$/, '')}/message/sendText/${instanceName}`
       }
    }
    
    // UaZapi V2 envia `body: { number, text }` e header `token` ou `apikey`.
    // Evolution V1/V2 envia `body: { number, text }` e header `apikey`.
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey, 
        'token': apiKey, // UaZapi V2 alternativo
        'Client-Token': apiKey, 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        number: `55${phone}`, 
        phone: `55${phone}`,  
        text: mensagem,       
        message: mensagem     
      }),
    })

    if (!res.ok) {
      console.error('[WhatsApp] Error:', await res.text())
      return false
    }

    return true
  } catch (error) {
    console.error('[WhatsApp] Error:', error)
    return false
  }
}
