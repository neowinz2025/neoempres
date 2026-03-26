import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateToken } from '@/lib/auth'
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server'
import { headers } from 'next/headers'

function getRpConfig(host: string, protocol?: string) {
  const rpID = host.split(':')[0]
  // Se o protocolo não for fornecido, tenta adivinhar (localhost/127.0.0.1 = http, resto = https)
  const proto = protocol || (rpID === 'localhost' || rpID === '127.0.0.1' ? 'http' : 'https')
  const origin = `${proto}://${host}`
  return { rpID, origin }
}

// GET: generate authentication options
export async function GET(request: NextRequest) {
  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost'
    const protocol = headersList.get('x-forwarded-proto') || undefined
    const { rpID, origin } = getRpConfig(host, protocol)
    const allCreds = await prisma.webAuthnCredential.findMany({
      include: { user: true },
    })

    if (allCreds.length === 0) {
      return NextResponse.json({ error: 'Nenhuma biometria registrada' }, { status: 404 })
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: allCreds.map(c => ({
        id: c.credentialId,
        transports: c.transports ? (JSON.parse(c.transports) as any[]).filter(t => t !== 'hybrid') : undefined,
      })),
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
    console.error('WebAuthn login options error:', error)
    return NextResponse.json({ error: 'Erro ao gerar opções de autenticação' }, { status: 500 })
  }
}

// POST: verify authentication and issue JWT
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const challenge = request.cookies.get('webauthn-challenge')?.value
    if (!challenge) return NextResponse.json({ error: 'Challenge expirado' }, { status: 400 })

    const headersList = await headers()
    const host = headersList.get('host') || 'localhost'
    const protocol = headersList.get('x-forwarded-proto') || undefined
    const { rpID, origin } = getRpConfig(host, protocol)

    const credentialIdB64 = body.id
    const cred = await prisma.webAuthnCredential.findUnique({
      where: { credentialId: credentialIdB64 },
      include: { user: true },
    })

    if (!cred || !cred.user.active) {
      return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 401 })
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, 'base64url'),
        counter: cred.counter,
        transports: cred.transports ? (JSON.parse(cred.transports) as any[]).filter(t => t !== 'hybrid') : undefined,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Verificação falhou' }, { status: 401 })
    }

    // Update counter
    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { counter: verification.authenticationInfo.newCounter },
    })

    // Issue JWT token same as regular login
    const token = await generateToken({
      userId: cred.user.id,
      email: cred.user.email,
      role: cred.user.role,
      name: cred.user.name,
    })

    await prisma.log.create({
      data: {
        userId: cred.user.id,
        acao: 'LOGIN_BIOMETRIA',
        detalhes: `Login via biometria por ${cred.user.email}`,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      },
    })

    const response = NextResponse.json({
      success: true,
      user: { id: cred.user.id, name: cred.user.name, email: cred.user.email, role: cred.user.role },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: protocol === 'https',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    response.cookies.delete('webauthn-challenge')
    return response
  } catch (error) {
    console.error('WebAuthn login verify error:', error)
    return NextResponse.json({ error: 'Erro na autenticação biométrica' }, { status: 500 })
  }
}
