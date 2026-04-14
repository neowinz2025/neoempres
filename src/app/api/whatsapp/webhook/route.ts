import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Webhook para receber eventos da UaZapi / Evolution API / MegaAPI.
 * O provedor vai bater (POST) nessa URL sempre que algo acontecer 
 * (nova mensagem recebida, mudança de status de conexão, mensagem lida, etc).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('[WhatsApp Webhook Recebido]:', JSON.stringify(body, null, 2))

    // =========================================================================
    // EXEMPLO DE TRATAMENTO 1: Eventos de Conexão (CONNECTION_UPDATE)
    // =========================================================================
    if (body.event === 'CONNECTION_UPDATE' || body.event === 'connection.update') {
      const state = body.data?.state || body.state
      console.log(`[Status do WhatsApp alterado para]: ${state}`)
      
      // Aqui poderíamos salvar em prisma.config para atualizar o painel
    }

    // =========================================================================
    // EXEMPLO DE TRATAMENTO 2: Mensagens Recebidas (MESSAGES_UPSERT)
    // =========================================================================
    // Geralmente disparado quando um cliente responde a mensagem de cobrança
    const eventName = body.event || body.type
    if (eventName === 'MESSAGES_UPSERT' || eventName === 'message.upsert') {
      const messageData = body.data?.message || body.data || body.messages?.[0]
      
      // Ignora eventos que nós mesmos enviamos (fromMe)
      if (messageData && !messageData.key?.fromMe) {
        const telefoneRemetente = messageData.key?.remoteJid?.split('@')[0]
        
        console.log(`[Nova Mensagem de Cliente - ${telefoneRemetente}]: Chegou no Webhook!`)

        // AQUI você pode adicionar lógica no futuro para:
        // 1. Mandar um aviso automático: "Esta é uma mensagem automática de cobrança, não recebe respostas"
        // 2. Encaminhar para um chat humano.
        // 3. Criar uma tabela de "Chat" ou "Tickets" no painel.
      }
    }

    return NextResponse.json({ received: true, status: 'success' })
  } catch (error) {
    console.error('[Webhook Error]: Falha ao processar Webhook', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
