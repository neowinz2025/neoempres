import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ReceiptClient from './ReceiptClient'
import { headers as getHeaders } from 'next/headers'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

async function getReceiptData(id: string, token?: string) {
  try {
    const parcela = await prisma.parcela.findUnique({
      where: { id },
      include: {
        emprestimo: {
          include: { cliente: true }
        }
      }
    })

    if (!parcela) return null
    if (parcela.status !== 'PAGO' && parcela.status !== 'PARCIAL') return null

    // Simple security for public view
    if (token) {
      if (parcela.emprestimo.token !== token && parcela.emprestimo.cliente.token !== token) {
        return null
      }
    }

    return {
      id: parcela.id,
      numero: parcela.numero,
      totalParcelas: parcela.emprestimo.numParcelas,
      valorPago: parcela.valorPago || 0,
      dataPagamento: parcela.dataPagamento?.toISOString() || '',
      formaPagamento: parcela.formaPagamento || '',
      clienteNome: parcela.emprestimo.cliente.nome,
      emprestimoTipo: parcela.emprestimo.tipo,
      vencimento: parcela.vencimento.toISOString()
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params
  const { token } = await searchParams
  const data = await getReceiptData(id, token)

  if (!data) return { title: 'Comprovante não encontrado' }

  return {
    title: `Comprovante: ${data.clienteNome} - Parcela ${data.numero}`,
    description: `Pagamento de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.valorPago)} realizado em ${new Date(data.dataPagamento).toLocaleDateString('pt-BR')}`,
    openGraph: {
      type: 'website',
      title: 'Comprovante de Pagamento',
      description: `Comprovante da Parcela ${data.numero}/${data.totalParcelas} - ${data.clienteNome}`,
    }
  }
}

export default async function ReceiptPage({ params, searchParams }: Props) {
  const { id } = await params
  const { token } = await searchParams
  const data = await getReceiptData(id, token)
  
  // Note: We don't check for Admin session in the Server Component here 
  // because the Client component will also fetch or we can just rely on the token for external view.
  // Internal view from Admin panel should probably append the token or we can check session client-side.
  
  return <ReceiptClient data={data} error={!data ? 'Comprovante não encontrado ou acesso negado' : undefined} />
}
