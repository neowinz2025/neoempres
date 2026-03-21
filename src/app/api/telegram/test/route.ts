import { NextResponse, NextRequest } from 'next/server'
import { sendTelegram } from '@/lib/notifications/telegram'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let overrides = {}
  try {
    const body = await req.json()
    if (body) {
      overrides = { botToken: body.botToken, chatId: body.chatId }
    }
  } catch {}

  const result = await sendTelegram(`🔔 <b>Teste de Conexão Bem Sucedido!</b>\n\nA integração com o Telegram está ativa e configurada corretamente no seu sistema LoanPro.`, overrides)
  
  if (result.success) return NextResponse.json({ success: true })
  return NextResponse.json({ error: result.error || 'Failed to send' }, { status: 500 })
}
