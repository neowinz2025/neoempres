import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server'

const rpName = 'LoanPro'
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost'
const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`

// GET: generate registration options
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const existingCreds = await prisma.webAuthnCredential.findMany({
      where: { userId: session.userId },
    })

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: session.email,
      userDisplayName: session.name,
      attestationType: 'none',
      excludeCredentials: existingCreds.map(c => ({
        id: c.credentialId,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    // Store challenge temporarily in cookie
    const response = NextResponse.json({ options })
    response.cookies.set('webauthn-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 300,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('WebAuthn register options error:', error)
    return NextResponse.json({ error: 'Erro ao gerar opções de registro' }, { status: 500 })
  }
}

// POST: verify registration and save credential
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await request.json()
    const challenge = request.cookies.get('webauthn-challenge')?.value
    if (!challenge) return NextResponse.json({ error: 'Challenge expirado' }, { status: 400 })

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Verificação falhou' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    await prisma.webAuthnCredential.create({
      data: {
        credentialId: Buffer.from(credential.id).toString('base64url'),
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: body.response?.transports ? JSON.stringify(body.response.transports) : null,
        userId: session.userId,
      },
    })

    const response = NextResponse.json({ success: true })
    response.cookies.delete('webauthn-challenge')
    return response
  } catch (error) {
    console.error('WebAuthn register verify error:', error)
    return NextResponse.json({ error: 'Erro ao registrar biometria' }, { status: 500 })
  }
}
