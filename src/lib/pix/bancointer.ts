import { PixProvider, PixChargeResult, PixStatusResult } from './provider'

export class BancoInterProvider implements PixProvider {
  name = 'BancoInter'

  async createCharge(_amount: number, _description?: string): Promise<PixChargeResult> {
    throw new Error('Banco Inter provider not configured. Please provide API credentials.')
  }

  async getStatus(_txId: string): Promise<PixStatusResult> {
    throw new Error('Banco Inter provider not configured. Please provide API credentials.')
  }
}
