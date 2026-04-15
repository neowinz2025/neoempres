import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { phone, message } = await request.json()

    if (!phone || !message) {
      return NextResponse.json({ error: 'Telefone e mensagem são obrigatórios' }, { status: 400 })
    }

    const success = await sendWhatsApp(phone, message)

    if (success) {
      return NextResponse.json({ success: true, message: 'Mensagem enviada com sucesso!' })
    } else {
      return NextResponse.json({ error: 'Falha ao enviar mensagem. Verifique se a instância está conectada e as credenciais estão corretas.' }, { status: 500 })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro interno no teste de WhatsApp' }, { status: 500 })
  }
}
