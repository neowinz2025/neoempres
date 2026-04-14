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

    // Z-API OnReceive Event (Mensagem Recebida)
    if (body.phone && body.message) {
      const messageData = body.message
      
      // Ignora eventos que nós mesmos enviamos (fromMe)
      if (!messageData.key?.fromMe) {
        const telefoneRemetente = body.phone
        
        // Extrai o texto da mensagem (pode vir em conversation ou text)
        const textoMsg = (messageData.conversation || messageData.text || messageData.extendedTextMessage?.text || '').toLowerCase()

        console.log(`[Z-API Nova Mensagem de ${telefoneRemetente}]: ${textoMsg}`)

        // Se o cliente pedir PIX ou boleto
        if (textoMsg.includes('pix') || textoMsg.includes('pagar') || textoMsg.includes('boleto')) {
          
          // Busca cliente pelo telefone
          const phoneSearch = telefoneRemetente.replace(/^55/, '') // Tira o 55 principal
          
          const cliente = await prisma.cliente.findFirst({
            where: { telefone: { contains: phoneSearch } },
            include: {
              emprestimos: {
                where: { status: 'ATIVO' },
                include: {
                  parcelas: {
                    where: { status: { in: ['PENDENTE', 'ATRASADO'] } },
                    orderBy: { vencimento: 'asc' },
                    take: 1
                  }
                }
              }
            }
          })

          if (cliente) {
             const primeiraParcela = cliente.emprestimos
                .flatMap(e => e.parcelas)
                .sort((a, b) => a.vencimento.getTime() - b.vencimento.getTime())[0]

             if (primeiraParcela) {
                // Monta a Chave PIX (Nesse caso o sistema tem um método gerador, mas como base vamos só mandar a instrução ou a chave Pix)
                // Vamos mandar um aviso dinâmico:
                const configs = await prisma.config.findMany({ where: { key: { in: ['CHAVEPIX_CHAVE', 'CHAVEPIX_NOME'] }}})
                const pChave = configs.find(c => c.key === 'CHAVEPIX_CHAVE')?.value
                const pNome = configs.find(c => c.key === 'CHAVEPIX_NOME')?.value

                if (pChave) {
                  const replyText = `🤖 *Assistente NeoEmpres*\n\nOlá *${cliente.nome}*!\nVi que você deseja pagar a parcela de vencimento ${primeiraParcela.vencimento.toLocaleDateString('pt-BR')} (R$ ${primeiraParcela.valor.toFixed(2)}).\n\n💳 *Chave PIX:* ${pChave}\n👤 *Recebedor:* ${pNome || 'NeoEmpres'}\n\nAssim que fizer a transferência, nosso sistema dará a baixa no seu contrato.`
                  
                  import('@/lib/notifications/whatsapp').then(mod => {
                     mod.sendWhatsApp(telefoneRemetente, replyText).catch(e => console.error('[Bot]', e))
                  }).catch(() => {})
                }
             } else {
                 const replyText = `🤖 *Assistente NeoEmpres*\n\nOlá *${cliente.nome}*!\nVerifiquei aqui e você não possui nenhuma parcela pendente no momento. Está tudo em dia! 🎉`
                 import('@/lib/notifications/whatsapp').then(mod => {
                     mod.sendWhatsApp(telefoneRemetente, replyText)
                 }).catch(() => {})
             }
          }
        }
      }
    }

    return NextResponse.json({ received: true, status: 'success' })
  } catch (error) {
    console.error('[Webhook Error]: Falha ao processar Webhook', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
