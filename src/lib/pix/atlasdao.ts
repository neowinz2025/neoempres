import { PixProvider, PixChargeResult, PixStatusResult } from './provider'
import { prisma } from '@/lib/prisma'

export class AtlasDaoProvider implements PixProvider {
  name = 'AtlasDao'
  private baseUrl = 'https://api.atlasdao.info/api/v1/external'

  private async getApiKey(): Promise<string> {
    const config = await prisma.config.findUnique({ where: { key: 'ATLASDAO_API_KEY' } })
    return config?.value || process.env.ATLASDAO_API_KEY || ''
  }

  private async request(method: string, path: string, body?: Record<string, unknown>) {
    const apiKey = await this.getApiKey()
    if (!apiKey) throw new Error('AtlasDao API Key not configured')

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json()
    if (!res.ok) {
      console.error('[AtlasDao Error]', data)
      throw new Error(data.message || (data.errors ? JSON.stringify(data.errors) : JSON.stringify(data)) || `AtlasDao API error: ${res.status}`)
    }
    return data
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    const body: Record<string, unknown> = { amount }
    if (description) {
      body.description = description
    }
    
    body.merchantOrderId = `ORDER-${Math.random().toString(36).substring(7)}`

    const walletConf = await prisma.config.findUnique({ where: { key: 'ATLASDAO_WALLET_ADDRESS' } })
    if (walletConf?.value) {
      body.depixAddress = walletConf.value
    }

    // Attempt to fetch webhook url/secret from config to pass dynamically
    const webhookUrlConf = await prisma.config.findUnique({ where: { key: 'APP_WEBHOOK_URL' } })
    const webhookSecretConf = await prisma.config.findUnique({ where: { key: 'ATLASDAO_WEBHOOK_SECRET' } })
    
    if (webhookUrlConf?.value && webhookSecretConf?.value) {
      body.webhook = {
        url: webhookUrlConf.value,
        events: ['transaction.created', 'transaction.paid'],
        secret: webhookSecretConf.value
      }
    }

    let data = await this.request('POST', '/pix/create', body)

    // AtlasDAO may nest response under 'data', 'result', or 'transaction'
    if (data.data && typeof data.data === 'object') data = data.data
    else if (data.result && typeof data.result === 'object') data = data.result
    else if (data.transaction && typeof data.transaction === 'object') data = data.transaction

    console.log('[AtlasDao] Full response keys:', Object.keys(data))
    console.log('[AtlasDao] Response data:', JSON.stringify(data, null, 2))

    // Try many possible field names for QR code data
    const qrCodeImage = data.qrCode || data.qr_code || data.qrcode || data.qrCodeBase64 || data.qr_code_base64 || data.image || null
    const qrCodeText = data.qrCodeText || data.qr_code_text || data.payload || data.pixCopiaECola || data.pix_copia_cola || data.brcode || data.emv || data.copyAndPaste || ''

    // AtlasDao format extrapolation
    return {
      txId: String(data.id || data.transactionId || data.transaction_id || data.txId || Math.random().toString(36).substring(7)),
      qrCode: qrCodeImage,
      qrCodeText: qrCodeText,
      expiresAt: data.expiresAt || data.expires_at || null,
      amount: data.amount || amount,
      provider: this.name,
    }
  }

  async getStatus(txId: string): Promise<PixStatusResult> {
    const data = await this.request('GET', `/pix/status/${txId}`)

    const statusMap: Record<string, PixStatusResult['status']> = {
      pending: 'pending',
      paid: 'paid',
      completed: 'paid',
      expired: 'expired',
      cancelled: 'cancelled',
      failed: 'cancelled'
    }

    return {
      txId: String(txId),
      status: statusMap[data.status] || 'pending',
      paidAt: data.paidAt || data.paid_at || null,
      amount: data.amount,
    }
  }
}
