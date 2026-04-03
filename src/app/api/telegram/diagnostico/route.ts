import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

/**
 * Diagnostic endpoint — returns the full Telegram config status
 * (without exposing the actual token value)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const [botConf, chatConf] = await Promise.all([
      prisma.config.findUnique({ where: { key: 'TELEGRAM_BOT_TOKEN' } }),
      prisma.config.findUnique({ where: { key: 'TELEGRAM_CHAT_ID' } }),
    ])

    const botToken = botConf?.value || process.env.TELEGRAM_BOT_TOKEN || ''
    const chatId = chatConf?.value || process.env.TELEGRAM_CHAT_ID || ''

    // Detect if token was accidentally saved as masked value (••••xxxx)
    const tokenCorrupted = botToken.includes('••••') || botToken.includes('\u2022')
    const chatCorrupted = chatId.includes('••••') || chatId.includes('\u2022')

    const hasToken = botToken.length > 10 && !tokenCorrupted
    const hasChat = chatId.length > 0 && !chatCorrupted

    let apiStatus = 'NOT_TESTED'
    let apiError = ''

    if (hasToken && hasChat) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
        const data = await res.json()
        if (data.ok) {
          apiStatus = 'OK'
        } else {
          apiStatus = 'INVALID_TOKEN'
          apiError = data.description || 'Token inválido'
        }
      } catch (e) {
        apiStatus = 'NETWORK_ERROR'
        apiError = String(e)
      }
    }

    return NextResponse.json({
      data: {
        hasToken,
        hasChat,
        tokenCorrupted,
        chatCorrupted,
        tokenSource: botConf ? 'DATABASE' : (process.env.TELEGRAM_BOT_TOKEN ? 'ENV' : 'MISSING'),
        chatSource: chatConf ? 'DATABASE' : (process.env.TELEGRAM_CHAT_ID ? 'ENV' : 'MISSING'),
        chatId: hasChat ? chatId : null, // Chat ID is not sensitive, show it
        apiStatus,
        apiError,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao diagnosticar Telegram' }, { status: 500 })
  }
}
