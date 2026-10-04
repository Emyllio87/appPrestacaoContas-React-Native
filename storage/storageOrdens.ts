import AsyncStorage from '@react-native-async-storage/async-storage';
import { OrdemPagamento, TipoChavePix } from '../types';

const KEY_ORDENS = '@ordens_pagamento:ordens';

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function getItem<T>(chave: string): Promise<T[]> {
  try {
    const json = await AsyncStorage.getItem(chave);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function setItem<T>(chave: string, valor: T[]): Promise<void> {
  await AsyncStorage.setItem(chave, JSON.stringify(valor));
}

export async function getOrdensPagamento(): Promise<OrdemPagamento[]> {
  return getItem<OrdemPagamento>(KEY_ORDENS);
}

/**
 * Próximo número sequencial considerando o maior número já utilizado.
 * O cálculo anterior (length + 1) repetia números após exclusões.
 */
function calcularProximoNumero(ordens: OrdemPagamento[]): string {
  const maior = ordens.reduce((acc, ordem) => {
    const numero = Number.parseInt(String(ordem.numero).replace(/\D/g, ''), 10);
    return Number.isFinite(numero) && numero > acc ? numero : acc;
  }, 0);
  return `OP-${String(maior + 1).padStart(3, '0')}`;
}

export async function obterProximoNumeroOrdem(): Promise<string> {
  const ordens = await getOrdensPagamento();
  return calcularProximoNumero(ordens);
}

export async function addOrdemPagamento(dados: {
  fornecedor: string;
  tipoChavePix: TipoChavePix;
  pixInfo: string;
  valor: number;
  assunto: string;
  /** Opcional: permite salvar ordem sem registro de imagem. */
  imagemUri?: string;
}): Promise<OrdemPagamento> {
  const ordens = await getOrdensPagamento();
  const nova: OrdemPagamento = {
    id: gerarId(),
    numero: calcularProximoNumero(ordens),
    ...dados,
    imagemUri: dados.imagemUri ?? '',
    status: 'pendente',
    criadoEm: new Date().toISOString(),
  };
  await setItem(KEY_ORDENS, [...ordens, nova]);
  return nova;
}

export async function updateOrdemPagamento(
  id: string,
  dados: Partial<Pick<OrdemPagamento, 'fornecedor' | 'tipoChavePix' | 'pixInfo' | 'valor' | 'assunto' | 'imagemUri' | 'status'>>
): Promise<void> {
  const ordens = await getOrdensPagamento();
  const atualizadas = ordens.map((o) => (o.id === id ? { ...o, ...dados } : o));
  await setItem(KEY_ORDENS, atualizadas);
}

export async function deleteOrdemPagamento(id: string): Promise<void> {
  const ordens = await getOrdensPagamento();
  await setItem(KEY_ORDENS, ordens.filter((o) => o.id !== id));
}
