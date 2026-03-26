const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  try {
    const parcelasPagas = await prisma.parcela.findMany({
      where: { status: 'PAGO' },
      include: { emprestimo: true },
    });

    console.log(`Found ${parcelasPagas.length} paid installments.`);
    
    let jurosRecebidos = 0;
    for (const p of parcelasPagas) {
      const vPago = p.valorPago || 0;
      const vOriginal = p.valorOriginal || 0;
      const e = p.emprestimo;
      
      console.log(`Checking Parcela #${p.numero} of Loan ${e.id} (${e.tipo}):`);
      console.log(`  valorPago: ${vPago}, valorOriginal: ${vOriginal}`);
      
      let baseInterest = 0;
      if (e.tipo === 'BULLET') {
        const i = e.taxaJuros / 100;
        baseInterest = Math.round(e.valor * i * 100) / 100;
      } else if (e.tipo === 'SIMPLE') {
        const i = e.taxaJuros / 100;
        baseInterest = Math.round(e.valor * i * 100) / 100;
      } else if (e.tipo === 'PRICE') {
        const i = e.taxaJuros / 100;
        const n = e.numParcelas;
        const pmt = e.valor * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
        const totalJurosPrevisto = (pmt * n) - e.valor;
        baseInterest = totalJurosPrevisto / n;
      }
      
      const lateFees = Math.max(0, vPago - vOriginal);
      console.log(`  baseInterest: ${baseInterest}, lateFees: ${lateFees}`);
      jurosRecebidos += baseInterest + lateFees;
    }
    
    console.log(`Final Juros Recebidos: ${jurosRecebidos}`);

  } catch (error) {
    console.error('Diagnosis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
