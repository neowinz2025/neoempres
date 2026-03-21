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
      throw new Error(data.message || `AtlasDao API error: ${res.status}`)
    }
    return data
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    const body: Record<string, unknown> = { amount }
    if (description) {
      body.description = description
    }

    // Attempt to fetch webhook url/secret from config to pass dynamically
    const webhookUrlConf = await prisma.config.findUnique({ where: { key: 'APP_WEBHOOK_URL' } })
    const webhookSecretConf = await prisma.config.findUnique({ where: { key: 'ATLASDAO_WEBHOOK_SECRET' } })
    
    if (webhookUrlConf?.value && webhookSecretConf?.value) {
      body.webhook = {
        url: webhookUrlConf.value,
        events: ['transaction.created', 'transaction.paid', 'payment.completed'],
        secret: webhookSecretConf.value
      }
    }

    const data = await this.request('POST', '/pix/create', body)

    // AtlasDao format extrapolation
    return {
      txId: String(data.id || data.transactionId || Math.random().toString(36).substring(7)),
      qrCode: data.qrCode || data.qr_code || null,
      qrCodeText: data.qrCodeText || data.qr_code_text || data.payload || '',
      expiresAt: data.expiresAt || null,
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
