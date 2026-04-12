import { PixProvider, PixChargeResult, PixStatusResult } from './provider'
import { prisma } from '@/lib/prisma'

export class BitBridgeProvider implements PixProvider {
  name = 'BitBridge'
  private baseUrl = 'https://ebroodghpxmwwfbikvyu.supabase.co/functions/v1'

  private async getApiKey(): Promise<string> {
    const config = await prisma.config.findUnique({ where: { key: 'BITBRIDGE_API_KEY' } })
    return config?.value || process.env.BITBRIDGE_API_KEY || ''
  }

  private async request(path: string, body: Record<string, unknown>) {
    const apiKey = await this.getApiKey()
    if (!apiKey) throw new Error('BitBridge API Key not configured')

    const url = `${this.baseUrl}${path}`
    console.log(`[BitBridge] POST ${url}`)
    console.log('[BitBridge] Request body:', JSON.stringify(body, null, 2))

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const rawText = await res.text()
    console.log(`[BitBridge] Response status: ${res.status}`)
    console.log(`[BitBridge] Raw response: ${rawText.substring(0, 2000)}`)

    let data: Record<string, unknown>
    try {
      data = JSON.parse(rawText)
    } catch {
      throw new Error(`BitBridge returned non-JSON: ${rawText.substring(0, 200)}`)
    }

    if (!res.ok || data.error_code) {
      console.error('[BitBridge Error]', data)
      const msg = (data.message as string) || (data.error_code as string) || `BitBridge API error: ${res.status}`
      throw new Error(msg)
    }

    return data
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    // BitBridge expects amount in centavos (integer)
    const amountCentavos = Math.round(amount * 100)

    const body: Record<string, unknown> = {
      amount: amountCentavos,
      external_ref: `ORDER-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    }
    if (description) body.description = description

    const data = await this.request('/depix-create-pix', body)

    const txId = String(data.txid || data.operation_id || `bb-${Date.now()}`)
    const qrCodeText = String(data.copy_paste || data.qr_code || '')
    const qrCode = (data.qr_code && typeof data.qr_code === 'string' && data.qr_code.length > 50)
      ? (data.qr_code as string)
      : null

    console.log('[BitBridge] txId:', txId)
    console.log('[BitBridge] QR text length:', qrCodeText.length)

    return {
      txId,
      qrCode,
      qrCodeText,
      expiresAt: (data.expires_at as string) || null,
      amount: typeof data.amount === 'number' ? data.amount / 100 : amount,
      provider: this.name,
    }
  }

  async getStatus(txId: string): Promise<PixStatusResult> {
    // BitBridge uses the create endpoint model; status check not documented.
    // Fall back to pending until webhook fires.
    console.log(`[BitBridge] getStatus called for ${txId} — no status endpoint available, returning pending`)
    return {
      txId,
      status: 'pending',
      paidAt: null,
      amount: 0,
    }
  }
}
