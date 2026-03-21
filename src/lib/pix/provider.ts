export interface PixChargeResult {
  txId: string
  qrCode: string | null
  qrCodeText: string
  expiresAt: string | null
  amount: number
  provider: string
}

export interface PixStatusResult {
  txId: string
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  paidAt: string | null
  amount: number
}

export interface PixProvider {
  name: string
  createCharge(amount: number, description?: string): Promise<PixChargeResult>
  getStatus(txId: string): Promise<PixStatusResult>
}
