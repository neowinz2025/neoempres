import { PixProvider, PixChargeResult, PixStatusResult } from './provider'
import { FastDePixProvider } from './fastdepix'
import { AtlasDaoProvider } from './atlasdao'
import { BancoInterProvider } from './bancointer'

class PixManager {
  private providers: PixProvider[]

  constructor() {
    this.providers = [
      new AtlasDaoProvider()
    ]
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    let lastError: Error | null = null

    for (const provider of this.providers) {
      try {
        console.log(`[PIX] Trying provider: ${provider.name}`)
        const result = await provider.createCharge(amount, description)
        console.log(`[PIX] Success with provider: ${provider.name}`)
        return result
      } catch (error) {
        lastError = error as Error
        console.error(`[PIX] Provider ${provider.name} failed:`, (error as Error).message)
      }
    }

    throw new Error(`All PIX providers failed. Last error: ${lastError?.message}`)
  }

  async getStatus(txId: string, providerName?: string): Promise<PixStatusResult> {
    if (providerName) {
      const provider = this.providers.find(p => p.name === providerName)
      if (provider) {
        return provider.getStatus(txId)
      }
    }

    let lastError: Error | null = null
    for (const provider of this.providers) {
      try {
        return await provider.getStatus(txId)
      } catch (error) {
        lastError = error as Error
      }
    }

    throw new Error(`Could not get status from any provider. Last error: ${lastError?.message}`)
  }
}

export const pixManager = new PixManager()
