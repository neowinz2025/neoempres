import { prisma } from '@/lib/prisma'

export async function sendTelegram(mensagem: string, chatIdOverride?: string): Promise<{success: boolean; error?: string}> {
  const botConf = await prisma.config.findUnique({ where: { key: 'TELEGRAM_BOT_TOKEN' } })
  const botToken = botConf?.value || process.env.TELEGRAM_BOT_TOKEN

  const chatConf = await prisma.config.findUnique({ where: { key: 'TELEGRAM_CHAT_ID' } })
  const chatId = chatIdOverride || chatConf?.value || process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    return { success: false, error: 'Token ou ChatID ausente nas configurações.' }
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
      const errText = await res.text()
      console.error('[Telegram] Error:', errText)
      return { success: false, error: errText }
    }

    return { success: true }
  } catch (error) {
    console.error('[Telegram] Error:', error)
    return { success: false, error: String(error) }
  }
}
