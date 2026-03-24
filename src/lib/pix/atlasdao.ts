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

    const url = `${this.baseUrl}${path}`
    console.log(`[AtlasDao] ${method} ${url}`)
    if (body) console.log('[AtlasDao] Request body:', JSON.stringify(body, null, 2))

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const rawText = await res.text()
    console.log(`[AtlasDao] Response status: ${res.status}`)
    console.log(`[AtlasDao] Raw response: ${rawText.substring(0, 2000)}`)

    let data
    try {
      data = JSON.parse(rawText)
    } catch {
      throw new Error(`AtlasDao returned non-JSON: ${rawText.substring(0, 200)}`)
    }

    if (!res.ok) {
      console.error('[AtlasDao Error]', data)
      throw new Error(data.message || JSON.stringify(data) || `AtlasDao API error: ${res.status}`)
    }
    return data
  }

  /**
   * Recursively search an object for QR code fields
   */
  private findQrFields(obj: Record<string, unknown>, depth = 0): { qrCodeText: string; qrCodeImage: string | null } {
    if (depth > 3) return { qrCodeText: '', qrCodeImage: null }

    // Direct field names to check
    const textKeys = ['qrCode', 'qr_code', 'payload', 'brcode', 'emv', 'pixCopiaECola', 'pix_copia_cola', 'copyAndPaste', 'qr_code_text', 'qrCodeText']
    const imageKeys = ['qrCodeImage', 'qr_code_image', 'qrcode_image', 'image', 'qrCodeBase64', 'qr_code_base64']

    let qrCodeText = ''
    let qrCodeImage: string | null = null

    for (const key of textKeys) {
      if (obj[key] && typeof obj[key] === 'string' && (obj[key] as string).length > 20) {
        qrCodeText = obj[key] as string
        console.log(`[AtlasDao] Found QR text in field '${key}' (${qrCodeText.length} chars)`)
        break
      }
    }

    for (const key of imageKeys) {
      if (obj[key] && typeof obj[key] === 'string' && (obj[key] as string).length > 50) {
        qrCodeImage = obj[key] as string
        console.log(`[AtlasDao] Found QR image in field '${key}' (${qrCodeImage.length} chars)`)
        break
      }
    }

    // If not found, search nested objects
    if (!qrCodeText && !qrCodeImage) {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          console.log(`[AtlasDao] Searching nested object '${key}'...`)
          const nested = this.findQrFields(value as Record<string, unknown>, depth + 1)
          if (nested.qrCodeText) qrCodeText = nested.qrCodeText
          if (nested.qrCodeImage) qrCodeImage = nested.qrCodeImage
          if (qrCodeText || qrCodeImage) break
        }
      }
    }

    return { qrCodeText, qrCodeImage }
  }

  /**
   * Extract transaction ID from response
   */
  private extractTxId(obj: Record<string, unknown>): string {
    const idKeys = ['id', 'transactionId', 'transaction_id', 'txId', 'tx_id']
    for (const key of idKeys) {
      if (obj[key]) return String(obj[key])
    }
    // Check nested data
    if (obj.data && typeof obj.data === 'object') {
      for (const key of idKeys) {
        if ((obj.data as Record<string, unknown>)[key]) return String((obj.data as Record<string, unknown>)[key])
      }
    }
    return ''
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    const body: Record<string, unknown> = { amount }
    if (description) {
      body.description = description
    }
    
    body.merchantOrderId = `ORDER-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const walletConf = await prisma.config.findUnique({ where: { key: 'ATLASDAO_WALLET_ADDRESS' } })
    if (walletConf?.value) {
      body.depixAddress = walletConf.value
      console.log('[AtlasDao] Using depixAddress:', walletConf.value.substring(0, 10) + '...')
    } else {
      console.warn('[AtlasDao] WARNING: ATLASDAO_WALLET_ADDRESS not configured! QR code may not be generated.')
    }

    // Webhook config
    const webhookUrlConf = await prisma.config.findUnique({ where: { key: 'APP_WEBHOOK_URL' } })
    const webhookSecretConf = await prisma.config.findUnique({ where: { key: 'ATLASDAO_WEBHOOK_SECRET' } })
    
    if (webhookUrlConf?.value && webhookSecretConf?.value) {
      body.webhook = {
        url: webhookUrlConf.value,
        events: ['transaction.created', 'transaction.paid'],
        secret: webhookSecretConf.value
      }
    }

    // Step 1: Create the charge
    const createResponse = await this.request('POST', '/pix/create', body)
    
    const txId = this.extractTxId(createResponse)
    console.log('[AtlasDao] Extracted txId:', txId)

    // Step 2: Try to find QR data in the CREATE response first
    let { qrCodeText, qrCodeImage } = this.findQrFields(createResponse)

    // Step 3: If no QR found in create response, try the STATUS endpoint
    if (!qrCodeText && !qrCodeImage && txId) {
      console.log('[AtlasDao] No QR in create response, fetching from status endpoint...')
      try {
        await new Promise(resolve => setTimeout(resolve, 800))
        const statusResponse = await this.request('GET', `/pix/status/${txId}`)
        const statusQr = this.findQrFields(statusResponse)
        if (statusQr.qrCodeText) qrCodeText = statusQr.qrCodeText
        if (statusQr.qrCodeImage) qrCodeImage = statusQr.qrCodeImage
      } catch (statusErr) {
        console.error('[AtlasDao] Failed to fetch status:', statusErr)
      }
    }

    if (!qrCodeText && !qrCodeImage) {
      console.error('[AtlasDao] CRITICAL: No QR code data found in either create or status response!')
    }

    return {
      txId: txId || `fallback-${Date.now()}`,
      qrCode: qrCodeImage,
      qrCodeText,
      expiresAt: createResponse.expiresAt || createResponse.expires_at || null,
      amount: createResponse.amount || amount,
      provider: this.name,
    }
  }

  async getStatus(txId: string): Promise<PixStatusResult> {
    const data = await this.request('GET', `/pix/status/${txId}`)

    // Unwrap if nested
    const record = (data.data && typeof data.data === 'object') ? data.data : data

    const statusMap: Record<string, PixStatusResult['status']> = {
      pending: 'pending', PENDING: 'pending',
      paid: 'paid', PAID: 'paid',
      completed: 'paid', COMPLETED: 'paid',
      expired: 'expired', EXPIRED: 'expired',
      cancelled: 'cancelled', CANCELLED: 'cancelled',
      failed: 'cancelled', FAILED: 'cancelled',
    }

    return {
      txId: String(txId),
      status: statusMap[record.status] || 'pending',
      paidAt: record.paidAt || record.paid_at || null,
      amount: record.amount,
    }
  }
}
