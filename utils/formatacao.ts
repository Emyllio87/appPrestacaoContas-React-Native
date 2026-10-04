// Formata um número para o padrão brasileiro: R$ 1.234,56
// Valores não finitos (NaN/Infinity/undefined vindo de dados antigos) viram zero
// para não poluir relatórios com "R$ NaN,undefined".
export function formatarMoeda(valor: number): string {
  const valorSeguro = typeof valor === 'number' && Number.isFinite(valor) ? valor : 0;
  const valorAbsoluto = Math.abs(valorSeguro).toFixed(2);
  const [inteiro, decimal] = valorAbsoluto.split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sinal = valorSeguro < 0 ? '-' : '';
  return `${sinal}R$ ${inteiroComPontos},${decimal}`;
}

// Formata o texto digitado pelo usuário em tempo real como moeda brasileira
// Ex: "123456" → "1.234,56" | "1234" → "12,34" | "1" → "0,01"
export function formatarMoedaInput(texto: string): string {
  const apenasDigitos = texto.replace(/\D/g, '');
  if (apenasDigitos === '') return '';

  const valorCentavos = parseInt(apenasDigitos, 10);
  const valorFormatado = (valorCentavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return valorFormatado;
}

// Converte o texto digitado pelo usuário (aceita "1.234,56" ou "1234,56"
// ou "1234.56") para um número usável em cálculos
export function parsearMoeda(texto: string): number {
  const limpo = texto
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // remove pontos de milhar
    .replace(',', '.');
  return Number(limpo);
}

// Valida se o texto digitado representa um valor monetário válido (> 0)
export function valorMoedaValido(texto: string): boolean {
  const valor = parsearMoeda(texto);
  return !isNaN(valor) && valor > 0;
}

// Máscara de telefone: (00) 00000-0000 ou (00) 0000-0000
export function formatarTelefone(texto: string): string {
  const apenasDigitos = texto.replace(/\D/g, '').slice(0, 11);
  if (apenasDigitos.length <= 10) {
    return apenasDigitos
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return apenasDigitos
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

// Máscara de CPF: 000.000.000-00
export function formatarCPF(texto: string): string {
  const apenasDigitos = texto.replace(/\D/g, '').slice(0, 11);
  return apenasDigitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

// Máscara de CNPJ: 00.000.000/0000-00
export function formatarCNPJ(texto: string): string {
  const apenasDigitos = texto.replace(/\D/g, '').slice(0, 14);
  return apenasDigitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
