import { PixProvider, PixChargeResult, PixStatusResult } from './provider'
import { prisma } from '@/lib/prisma'

export class FastDePixProvider implements PixProvider {
  name = 'FastDePix'
  private baseUrl = 'https://fastdepix.space/api/v1'

  private async getApiKey(): Promise<string> {
    const config = await prisma.config.findUnique({ where: { key: 'FASTDEPIX_API_KEY' } })
    return config?.value || process.env.FASTDEPIX_API_KEY || ''
  }

  private async request(method: string, path: string, body?: Record<string, unknown>) {
    const apiKey = await this.getApiKey()
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || `FastDePix API error: ${res.status}`)
    }
    return data.data
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    const body: Record<string, unknown> = { amount }
    if (description) {
      body.notes = description
    }

    const data = await this.request('POST', '/transactions', body)

    return {
      txId: String(data.id),
      qrCode: data.qr_code || null,
      qrCodeText: data.qr_code_text || '',
      expiresAt: data.expires_at || null,
      amount: data.amount,
      provider: this.name,
    }
  }

  async getStatus(txId: string): Promise<PixStatusResult> {
    const data = await this.request('GET', `/transactions/${txId}`)

    const statusMap: Record<string, PixStatusResult['status']> = {
      pending: 'pending',
      paid: 'paid',
      expired: 'expired',
      cancelled: 'cancelled',
      under_review: 'pending',
      refunded: 'cancelled',
    }

    return {
      txId: String(data.id),
      status: statusMap[data.status] || 'pending',
      paidAt: data.paid_at || null,
      amount: data.amount,
    }
  }
}
