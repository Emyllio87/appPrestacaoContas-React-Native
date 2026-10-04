import AsyncStorage from '@react-native-async-storage/async-storage';
import { Categoria, Despesa, OrdemPagamento, Prestacao, TipoChavePix } from '../../types';
import { resetPrint } from '../mocks/expo-print';
import { limparMemoria, semearArquivo } from '../mocks/memoria';

/** Tamanho (em caracteres base64) padrão dos cupons sem tratamento (~165 KB, acima do limite). */
export const TAMANHO_CUPOM_GRANDE = 220_000;
/** Tamanho dos cupons que já estão pequenos e não precisam de redimensionamento (~30 KB). */
export const TAMANHO_CUPOM_PEQUENO = 40_000;

export function resetAmbiente(): void {
  resetPrint();
  limparMemoria();
  (AsyncStorage as unknown as { __reset(): void }).__reset();
}

export function uriCupom(indice: number): string {
  return `file:///app/cache/cupom_${indice}.jpg`;
}

export function criarPrestacao(overrides: Partial<Prestacao> = {}): Prestacao {
  return {
    id: 'prest-1',
    descricao: 'Viagem Campo Grande',
    valorRecebido: 5000,
    data: '2026-01-10T12:00:00.000Z',
    status: 'aberta',
    ...overrides,
  };
}

export function criarCategoria(indice: number, nome = `Categoria ${indice}`): Categoria {
  return { id: `cat-${indice}`, nome };
}

export function criarDespesa(indice: number, overrides: Partial<Despesa> = {}): Despesa {
  const comCupom = overrides.cupomUri ?? uriCupom(indice);
  if (comCupom) {
    semearArquivo(comCupom, 'A'.repeat(TAMANHO_CUPOM_GRANDE));
  }
  return {
    id: `desp-${indice}`,
    prestacaoId: 'prest-1',
    descricao: `Despesa ${indice}`,
    categoriaId: 'cat-1',
    valor: 10 + indice,
    data: `2026-01-${String((indice % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    ...overrides,
    cupomUri: comCupom,
  };
}

export function criarDespesas(quantidade: number): Despesa[] {
  return Array.from({ length: quantidade }, (_, i) => criarDespesa(i + 1));
}

export function criarOrdem(overrides: Partial<OrdemPagamento> = {}): OrdemPagamento {
  return {
    id: 'ordem-1',
    numero: 'OP-001',
    fornecedor: 'Fornecedor Ltda',
    tipoChavePix: 'cpf' as TipoChavePix,
    pixInfo: '123.456.789-00',
    valor: 250.75,
    assunto: 'Compra de material',
    imagemUri: '',
    status: 'pendente',
    criadoEm: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

export function contarOcorrencias(texto: string, trecho: string): number {
  return texto.split(trecho).length - 1;
}

/**
 * Verifica se as tags de um documento HTML estão balanceadas.
 * Detecta descrições com caracteres especiais quebrando a marcação.
 */
export function htmlBalanceado(html: string): boolean {
  const aberturas = (html.match(/<(?!\/)[a-zA-Z][^>]*>/g) ?? []).filter(
    (tag) => !tag.endsWith('/>')
  );
  const fechamentos = html.match(/<\/[a-zA-Z][^>]*>/g) ?? [];
  if (aberturas.length !== fechamentos.length) return false;

  const pilha: string[] = [];
  const regex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let correspondencia: RegExpExecArray | null;
  while ((correspondencia = regex.exec(html)) !== null) {
    const [nome, barra] = [correspondencia[2].toLowerCase(), correspondencia[1]];
    if (['meta', 'br', 'img', 'link', 'input'].includes(nome)) continue;
    if (barra === '/') {
      const topo = pilha.pop();
      if (topo !== nome) return false;
    } else {
      pilha.push(nome);
    }
  }
  return pilha.length === 0;
}
