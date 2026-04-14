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

    // Z-API Helper: Se o usuário colou a URL completa de Send-Text
    let endpoint = baseUrl.trim()
    if (!endpoint.startsWith('http')) {
       // Se o usuário colocou apenas o ID da Instância Z-API e o Token
       endpoint = `https://api.z-api.io/instances/${endpoint}/token/${apiKey}/send-text`
    } else if (!endpoint.toLowerCase().includes('send-text') && !endpoint.toLowerCase().includes('sendtext')) {
       // Se colou a base URL mas esqueceu o send-text
       endpoint = `${endpoint.replace(/\/$/, '')}/send-text`
    }
    
    // Z-API envia `body: { phone, message }` e autenticação com `Client-Token`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': apiKey
      },
      body: JSON.stringify({
        phone: `55${phone}`,  // Padrão do Z-API
        message: mensagem     // Padrão do Z-API
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
