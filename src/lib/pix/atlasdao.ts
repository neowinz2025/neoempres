import { PixProvider, PixChargeResult, PixStatusResult } from './provider'

export class AtlasDaoProvider implements PixProvider {
  name = 'AtlasDao'

  async createCharge(_amount: number, _description?: string): Promise<PixChargeResult> {
    throw new Error('AtlasDao provider not configured. Please provide API credentials.')
  }

  async getStatus(_txId: string): Promise<PixStatusResult> {
    throw new Error('AtlasDao provider not configured. Please provide API credentials.')
  }
}
