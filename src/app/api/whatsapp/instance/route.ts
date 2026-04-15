import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const dbConfigs = await prisma.config.findMany({
      where: {
        key: 'WAPI_INTEGRATOR_TOKEN',
      },
    })
    
    const integratorToken = dbConfigs[0]?.value

    if (!integratorToken) {
      return NextResponse.json({ error: 'Token de Integrador W-API não configurado.' }, { status: 400 })
    }

    const instanceName = `LoanPro_${Date.now()}`

    const response = await fetch('https://api.w-api.app/v1/integrator/create-instance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${integratorToken}`
      },
      body: JSON.stringify({
        instanceName,
        rejectCalls: true,
        callMessage: "Olá! No momento não podemos atender chamadas de voz ou vídeo por este canal."
      })
    })

    const data = await response.json()

    if (!response.ok) {
        return NextResponse.json({ error: data.message || 'Erro ao criar instância no W-API' }, { status: response.status })
    }

    // Returned: { instanceId, token }
    const { instanceId, token } = data

    // Save into our configs
    await prisma.$transaction([
      prisma.config.upsert({
        where: { key: 'WAPI_INSTANCE_ID' },
        update: { value: instanceId },
        create: { key: 'WAPI_INSTANCE_ID', value: instanceId }
      }),
      prisma.config.upsert({
        where: { key: 'WAPI_TOKEN' },
        update: { value: token },
        create: { key: 'WAPI_TOKEN', value: token }
      }),
      prisma.config.upsert({
        where: { key: 'WAPI_ENABLED' },
        update: { value: 'true' },
        create: { key: 'WAPI_ENABLED', value: 'true' }
      })
    ])

    return NextResponse.json({ 
        success: true, 
        instanceId, 
        token 
    })

  } catch (error: any) {
    console.error('[W-API Instance Creation Error]:', error)
    return NextResponse.json({ error: 'Erro de conexão com o W-API.' }, { status: 500 })
  }
}
