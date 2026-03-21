import { NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/notifications/telegram'
import { getSession } from '@/lib/auth'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const ok = await sendTelegram(`🔔 <b>Teste de Conexão Bem Sucedido!</b>\n\nA integração com o Telegram está ativa e configurada corretamente no seu sistema LoanPro.`)
  
  if (ok) return NextResponse.json({ success: true })
  return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
}
