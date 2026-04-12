import { PixProvider, PixChargeResult, PixStatusResult } from './provider'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────
// PIX BR payload builder (EMV / QRCPS-MPM spec)
// ─────────────────────────────────────────────

function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0')
  return `${id}${len}${value}`
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim()
}

function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function buildPixPayload(chave: string, nome: string, cidade: string, valor: number): string {
  const nomeSafe  = removeAccents(nome).substring(0, 25) || 'FAVORECIDO'
  const cidadeSafe = removeAccents(cidade).substring(0, 15) || 'CIDADE'
  const valorStr  = valor.toFixed(2)
  const txId      = `***`

  const merchantAccount =
    tlv('00', 'br.gov.bcb.pix') +
    tlv('01', chave.trim())

  const additionalData = tlv('05', txId)

  const payload =
    tlv('00', '01') +               // Payload Format Indicator
    tlv('26', merchantAccount) +    // Merchant Account Information
    tlv('52', '0000') +             // MCC
    tlv('53', '986') +              // Currency (BRL)
    tlv('54', valorStr) +           // Amount
    tlv('58', 'BR') +               // Country
    tlv('59', nomeSafe) +           // Merchant name
    tlv('60', cidadeSafe) +         // City
    tlv('62', additionalData) +     // Additional data
    '6304'                          // CRC placeholder

  return payload + crc16(payload)
}

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export class ChavePixProvider implements PixProvider {
  name = 'ChavePix'

  private async getConfigs() {
    const keys = ['CHAVEPIX_CHAVE', 'CHAVEPIX_NOME', 'CHAVEPIX_CIDADE']
    const rows = await prisma.config.findMany({ where: { key: { in: keys } } })
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
    return {
      chave:  map['CHAVEPIX_CHAVE']  || process.env.CHAVEPIX_CHAVE  || '',
      nome:   map['CHAVEPIX_NOME']   || process.env.CHAVEPIX_NOME   || 'FAVORECIDO',
      cidade: map['CHAVEPIX_CIDADE'] || process.env.CHAVEPIX_CIDADE || 'CIDADE',
    }
  }

  async createCharge(amount: number, _description?: string): Promise<PixChargeResult> {
    const { chave, nome, cidade } = await this.getConfigs()

    if (!chave) throw new Error('Chave PIX não configurada')

    const payload = buildPixPayload(chave, nome, cidade, amount)

    // QR code image via free public API (no auth needed)
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}`

    const txId = `pix-${Date.now()}-${Math.random().toString(36).substring(7)}`

    console.log(`[ChavePix] payload gerado para chave ${chave.substring(0, 8)}... valor R$ ${amount.toFixed(2)}`)

    return {
      txId,
      qrCode: qrImageUrl,
      qrCodeText: payload,
      expiresAt: null,
      amount,
      provider: this.name,
    }
  }

  async getStatus(txId: string): Promise<PixStatusResult> {
    // Sem confirmação automática — sempre retorna pending
    // A baixa manual deve ser feita pelo operador no painel
    console.log(`[ChavePix] getStatus ${txId} — sem webhook, retornando pending`)
    return { txId, status: 'pending', paidAt: null, amount: 0 }
  }
}
