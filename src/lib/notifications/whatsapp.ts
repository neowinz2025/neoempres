export async function sendWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const isEnabled = process.env.EVOLUTION_ENABLED === 'true'
  const baseUrl = process.env.EVOLUTION_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instanceName = process.env.EVOLUTION_INSTANCE || 'principal'

  if (!isEnabled || !baseUrl || !apiKey || !instanceName) {
    console.warn('[WhatsApp] Evolution API not configured or disabled')
    return false
  }

  try {
    const phone = telefone.replace(/\D/g, '')
    const endpoint = `${baseUrl.replace(/\/$/, '')}/message/sendText/${instanceName}`
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: `55${phone}`,
        text: mensagem,
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
