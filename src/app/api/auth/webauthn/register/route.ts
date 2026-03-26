import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'
import { headers } from 'next/headers'

const rpName = 'LoanPro'

function getRpConfig(host: string, protocol?: string) {
  const rpID = host.split(':')[0]
  // Se o protocolo não for fornecido, tenta adivinhar (localhost/127.0.0.1 = http, resto = https)
  const proto = protocol || (rpID === 'localhost' || rpID === '127.0.0.1' ? 'http' : 'https')
  const origin = `${proto}://${host}`
  return { rpID, origin }
}

// GET: generate registration options
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const headersList = await headers()
    const host = headersList.get('host') || 'localhost'
    const protocol = headersList.get('x-forwarded-proto') || undefined
    const { rpID, origin } = getRpConfig(host, protocol)

    console.log('[WebAuthn Register] rpID:', rpID, 'user:', session.email, 'userId:', session.userId)

    let existingCreds: { credentialId: string; transports: string | null }[] = []
    try {
      existingCreds = await prisma.webAuthnCredential.findMany({
        where: { userId: session.userId },
        select: { credentialId: true, transports: true },
      })
    } catch (dbErr) {
      console.error('[WebAuthn Register] DB error (table may not exist):', dbErr)
      // Table may not exist yet, continue with empty array
    }

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: session.email,
      userDisplayName: session.name || session.email,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credentialId,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    })

    const response = NextResponse.json({ options })
    response.cookies.set('webauthn-challenge', options.challenge, {
      httpOnly: true,
      secure: protocol === 'https',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    })
    return response
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[WebAuthn Register] Error generating options:', msg, error)
    return NextResponse.json({ error: `Erro ao gerar opções: ${msg}` }, { status: 500 })
  }
}

// POST: verify registration and save credential
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const challenge = request.cookies.get('webauthn-challenge')?.value
    if (!challenge) return NextResponse.json({ error: 'Challenge expirado. Tente novamente.' }, { status: 400 })

    const headersList = await headers()
    const host = headersList.get('host') || 'localhost'
    const protocol = headersList.get('x-forwarded-proto') || undefined
    const { rpID, origin } = getRpConfig(host, protocol)

    console.log('[WebAuthn Verify] rpID:', rpID, 'origin:', origin)

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verificação biométrica falhou' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo
    const credentialIdB64 = Buffer.from(credential.id).toString('base64url')
    const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64url')

    console.log('[WebAuthn] Saving credential:', {
      credentialId: credentialIdB64,
      userId: session.userId,
      transports: body.response?.transports
    })

    try {
      await prisma.webAuthnCredential.create({
        data: {
          credentialId: credentialIdB64,
          publicKey: publicKeyB64,
          counter: credential.counter,
          transports: body.response?.transports ? JSON.stringify(body.response.transports.filter((t: string) => t !== 'hybrid')) : null,
          userId: session.userId,
        },
      })
    } catch (dbErr) {
      console.error('[WebAuthn] Prisma error saving credential:', dbErr)
      return NextResponse.json({ error: `Erro no banco de dados: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}` }, { status: 500 })
    }

    await prisma.log.create({
      data: {
        userId: session.userId,
        acao: 'REGISTRO_BIOMETRIA',
        detalhes: `Biometria registrada com sucesso para ${session.email}`,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    console.log('[WebAuthn] Credential registered for user:', session.email)

    const response = NextResponse.json({ success: true })
    response.cookies.delete('webauthn-challenge')
    return response
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[WebAuthn Register Verify] Error:', msg, error)
    return NextResponse.json({ error: `Erro ao registrar: ${msg}` }, { status: 500 })
  }
}
