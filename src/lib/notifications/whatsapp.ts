export async function sendWhatsApp(
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token = process.env.ZAPI_TOKEN

  if (!instanceId || !token) {
    console.warn('[WhatsApp] Z-API not configured')
    return false
  }

  try {
    const phone = telefone.replace(/\D/g, '')
    const res = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `55${phone}`,
          message: mensagem,
        }),
      }
    )

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
