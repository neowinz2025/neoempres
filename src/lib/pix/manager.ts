import { PixProvider, PixChargeResult, PixStatusResult } from './provider'
import { FastDePixProvider } from './fastdepix'
import { AtlasDaoProvider } from './atlasdao'
import { BancoInterProvider } from './bancointer'
import { BitBridgeProvider } from './bitbridge'
import { prisma } from '@/lib/prisma'

class PixManager {
  private async getActiveProvider(): Promise<PixProvider[]> {
    try {
      const config = await prisma.config.findUnique({ where: { key: 'PIX_PROVIDER' } })
      const selected = config?.value || 'atlasdao'

      if (selected === 'bitbridge') {
        return [new BitBridgeProvider()]
      }

      // default: AtlasDAO
      return [new AtlasDaoProvider()]
    } catch {
      // If DB fails, fall back to AtlasDAO
      return [new AtlasDaoProvider()]
    }
  }

  async createCharge(amount: number, description?: string): Promise<PixChargeResult> {
    const providers = await this.getActiveProvider()
    let lastError: Error | null = null

    for (const provider of providers) {
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
    const providers = await this.getActiveProvider()

    if (providerName) {
      const allProviders = [
        new AtlasDaoProvider(),
        new BitBridgeProvider(),
        new FastDePixProvider(),
        // BancoInterProvider is a stub, skip
      ]
      const provider = allProviders.find(p => p.name === providerName)
      if (provider) return provider.getStatus(txId)
    }

    let lastError: Error | null = null
    for (const provider of providers) {
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
