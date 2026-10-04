import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Categoria, Despesa, Prestacao } from '../types';

const KEYS = {
  PRESTACOES: '@prestacao_contas:prestacoes',
  DESPESAS: '@prestacao_contas:despesas',
  CATEGORIAS: '@prestacao_contas:categorias',
};

function gerarId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function deletarImagemSeExistir(uri: string): Promise<void> {
  if (!uri) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch {
    // Ignora erros de limpeza
  }
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

// ---------- Categorias ----------

export async function getCategorias(): Promise<Categoria[]> {
  return getItem<Categoria>(KEYS.CATEGORIAS);
}

export async function addCategoria(nome: string): Promise<Categoria> {
  const categorias = await getCategorias();
  const nova: Categoria = { id: gerarId(), nome };
  await setItem(KEYS.CATEGORIAS, [...categorias, nova]);
  return nova;
}

export async function deleteCategoria(id: string): Promise<void> {
  const categorias = await getCategorias();
  await setItem(KEYS.CATEGORIAS, categorias.filter((c) => c.id !== id));
}

// ---------- Prestações ----------

export async function getPrestacoes(): Promise<Prestacao[]> {
  return getItem<Prestacao>(KEYS.PRESTACOES);
}

export async function addPrestacao(dados: {
  descricao: string;
  valorRecebido: number;
  data?: string;
}): Promise<Prestacao> {
  const prestacoes = await getPrestacoes();
  const nova: Prestacao = {
    id: gerarId(),
    descricao: dados.descricao,
    valorRecebido: dados.valorRecebido,
    data: dados.data ?? new Date().toISOString(),
    status: 'aberta',
  };
  await setItem(KEYS.PRESTACOES, [...prestacoes, nova]);
  return nova;
}

export async function fecharPrestacao(id: string, saldo: number): Promise<void> {
  const prestacoes = await getPrestacoes();
  const atualizadas = prestacoes.map((p) =>
    p.id === id
      ? {
          ...p,
          status: 'fechada' as const,
          saldoTipo: saldo >= 0 ? ('caixa' as const) : ('reembolso' as const),
          saldoValor: Math.abs(saldo),
          dataFechamento: new Date().toISOString(),
        }
      : p
  );
  await setItem(KEYS.PRESTACOES, atualizadas);
}

export async function updatePrestacao(
  id: string,
  dados: Partial<Pick<Prestacao, 'descricao' | 'valorRecebido'>>
): Promise<void> {
  const prestacoes = await getPrestacoes();
  const atualizadas = prestacoes.map((p) =>
    p.id === id ? { ...p, ...dados } : p
  );
  await setItem(KEYS.PRESTACOES, atualizadas);
}

export async function abrirPrestacao(id: string): Promise<void> {
  const prestacoes = await getPrestacoes();
  const atualizadas = prestacoes.map((p) =>
    p.id === id
      ? {
          ...p,
          status: 'aberta' as const,
          saldoTipo: undefined,
          saldoValor: undefined,
          dataFechamento: undefined,
        }
      : p
  );
  await setItem(KEYS.PRESTACOES, atualizadas);
}

export async function deletePrestacao(id: string): Promise<void> {
  const prestacoes = await getPrestacoes();
  await setItem(KEYS.PRESTACOES, prestacoes.filter((p) => p.id !== id));

  const despesas = await getDespesas();
  const despesasDaPrestacao = despesas.filter((d) => d.prestacaoId === id);

  for (const despesa of despesasDaPrestacao) {
    if (despesa.cupomUri) {
      await deletarImagemSeExistir(despesa.cupomUri);
    }
  }

  await setItem(KEYS.DESPESAS, despesas.filter((d) => d.prestacaoId !== id));
}

// ---------- Despesas ----------

export async function getDespesas(): Promise<Despesa[]> {
  return getItem<Despesa>(KEYS.DESPESAS);
}

export async function getDespesasPorPrestacao(prestacaoId: string): Promise<Despesa[]> {
  const despesas = await getDespesas();
  return despesas
    .filter((d) => d.prestacaoId === prestacaoId)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
}

export async function addDespesa(dados: {
  prestacaoId: string;
  descricao: string;
  categoriaId: string;
  valor: number;
  cupomUri: string;
  data?: string;
}): Promise<Despesa> {
  const despesas = await getDespesas();
  const nova: Despesa = {
    id: gerarId(),
    prestacaoId: dados.prestacaoId,
    descricao: dados.descricao,
    categoriaId: dados.categoriaId,
    valor: dados.valor,
    cupomUri: dados.cupomUri,
    data: dados.data ?? new Date().toISOString(),
  };
  await setItem(KEYS.DESPESAS, [...despesas, nova]);
  return nova;
}

export async function deleteDespesa(id: string): Promise<void> {
  const despesas = await getDespesas();
  const despesa = despesas.find((d) => d.id === id);
  if (despesa?.cupomUri) {
    await deletarImagemSeExistir(despesa.cupomUri);
  }
  await setItem(KEYS.DESPESAS, despesas.filter((d) => d.id !== id));
}

export async function updateDespesa(
  id: string,
  dados: Partial<Pick<Despesa, 'descricao' | 'categoriaId' | 'valor' | 'cupomUri' | 'data'>>
): Promise<void> {
  const despesas = await getDespesas();

  if (dados.cupomUri) {
    const despesaAtual = despesas.find((d) => d.id === id);
    if (despesaAtual?.cupomUri && despesaAtual.cupomUri !== dados.cupomUri) {
      await deletarImagemSeExistir(despesaAtual.cupomUri);
    }
  }

  const atualizadas = despesas.map((d) =>
    d.id === id ? { ...d, ...dados } : d
  );
  await setItem(KEYS.DESPESAS, atualizadas);
}

// ---------- Importação (preserva IDs e datas originais) ----------

export async function importarPrestacao(prestacao: Prestacao): Promise<void> {
  const prestacoes = await getPrestacoes();
  await setItem(KEYS.PRESTACOES, [...prestacoes, prestacao]);
}

export async function importarCategoria(categoria: Categoria): Promise<void> {
  const categorias = await getCategorias();
  await setItem(KEYS.CATEGORIAS, [...categorias, categoria]);
}

export async function importarDespesa(despesa: Despesa): Promise<void> {
  const despesas = await getDespesas();
  await setItem(KEYS.DESPESAS, [...despesas, despesa]);
}
