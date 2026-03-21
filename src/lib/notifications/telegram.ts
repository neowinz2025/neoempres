export async function sendTelegram(
  chatId: string,
  mensagem: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    console.warn('[Telegram] Bot token not configured')
    return false
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: mensagem,
          parse_mode: 'HTML',
        }),
      }
    )

    if (!res.ok) {
      console.error('[Telegram] Error:', await res.text())
      return false
    }

    return true
  } catch (error) {
    console.error('[Telegram] Error:', error)
    return false
  }
}
