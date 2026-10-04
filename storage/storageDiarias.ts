import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiariaFuncionario, DiariaRegistro, DiariaFechamento, TipoChavePix } from '../types';

const KEYS = {
  FUNCIONARIOS: '@diarias:funcionarios',
  REGISTROS: '@diarias:registros',
  FECHAMENTOS: '@diarias:fechamentos',
};

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

// ---------- Funcionários ----------

export async function getFuncionarios(): Promise<DiariaFuncionario[]> {
  return getItem<DiariaFuncionario>(KEYS.FUNCIONARIOS);
}

export async function addFuncionario(dados: {
  nome: string;
  funcao: string;
  valorDiaria: number;
  telefone: string;
  tipoChavePix: TipoChavePix;
  pixInfo: string;
}): Promise<DiariaFuncionario> {
  const funcionarios = await getFuncionarios();
  const novo: DiariaFuncionario = {
    id: gerarId(),
    ...dados,
    criadoEm: new Date().toISOString(),
  };
  await setItem(KEYS.FUNCIONARIOS, [...funcionarios, novo]);
  return novo;
}

export async function updateFuncionario(
  id: string,
  dados: Partial<Pick<DiariaFuncionario, 'nome' | 'funcao' | 'valorDiaria' | 'telefone' | 'tipoChavePix' | 'pixInfo'>>
): Promise<void> {
  const funcionarios = await getFuncionarios();
  const atualizados = funcionarios.map((f) => (f.id === id ? { ...f, ...dados } : f));
  await setItem(KEYS.FUNCIONARIOS, atualizados);
}

export async function deleteFuncionario(id: string): Promise<void> {
  const funcionarios = await getFuncionarios();
  await setItem(KEYS.FUNCIONARIOS, funcionarios.filter((f) => f.id !== id));

  const registros = await getRegistros();
  await setItem(KEYS.REGISTROS, registros.filter((r) => r.funcionarioId !== id));

  const fechamentos = await getFechamentos();
  await setItem(KEYS.FECHAMENTOS, fechamentos.filter((f) => f.funcionarioId !== id));
}

// ---------- Registros de dias trabalhados ----------

export async function getRegistros(): Promise<DiariaRegistro[]> {
  return getItem<DiariaRegistro>(KEYS.REGISTROS);
}

export async function getRegistrosPorFuncionario(funcionarioId: string): Promise<DiariaRegistro[]> {
  const registros = await getRegistros();
  return registros
    .filter((r) => r.funcionarioId === funcionarioId)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export async function getRegistrosPendentes(funcionarioId: string): Promise<DiariaRegistro[]> {
  const registros = await getRegistros();
  return registros
    .filter((r) => r.funcionarioId === funcionarioId && !r.fechamentoId)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export async function getRegistrosPorPeriodo(inicio: string, fim: string): Promise<DiariaRegistro[]> {
  const registros = await getRegistros();
  const dataInicio = new Date(inicio).getTime();
  const dataFim = new Date(fim).getTime();
  return registros.filter((r) => {
    const d = new Date(r.data).getTime();
    return d >= dataInicio && d <= dataFim && !r.fechamentoId;
  });
}

export async function addRegistro(dados: {
  funcionarioId: string;
  data: string;
  observacao?: string;
  valorAdicional?: number;
}): Promise<DiariaRegistro> {
  const registros = await getRegistros();
  const novo: DiariaRegistro = {
    id: gerarId(),
    ...dados,
    valorAdicional: dados.valorAdicional ?? 0,
    criadoEm: new Date().toISOString(),
  };
  await setItem(KEYS.REGISTROS, [...registros, novo]);
  return novo;
}

export async function deleteRegistro(id: string): Promise<void> {
  const registros = await getRegistros();
  await setItem(KEYS.REGISTROS, registros.filter((r) => r.id !== id));
}

export async function updateRegistro(
  id: string,
  dados: Partial<Pick<DiariaRegistro, 'data' | 'observacao' | 'valorAdicional'>>
): Promise<void> {
  const registros = await getRegistros();
  const atualizados = registros.map((r) => (r.id === id ? { ...r, ...dados } : r));
  await setItem(KEYS.REGISTROS, atualizados);
}

// ---------- Fechamentos ----------

export async function getFechamentos(): Promise<DiariaFechamento[]> {
  return getItem<DiariaFechamento>(KEYS.FECHAMENTOS);
}

export async function getFechamentosPorFuncionario(funcionarioId: string): Promise<DiariaFechamento[]> {
  const fechamentos = await getFechamentos();
  return fechamentos
    .filter((f) => f.funcionarioId === funcionarioId)
    .sort((a, b) => new Date(b.fechadoEm).getTime() - new Date(a.fechadoEm).getTime());
}

export async function fecharPagamento(
  funcionarioId: string,
  periodoInicio: string,
  periodoFim: string
): Promise<DiariaFechamento> {
  const funcionarios = await getFuncionarios();
  const funcionario = funcionarios.find((f) => f.id === funcionarioId);
  if (!funcionario) throw new Error('Funcionário não encontrado');

  const registros = await getRegistrosPorPeriodo(periodoInicio, periodoFim);
  const registrosDoFuncionario = registros.filter((r) => r.funcionarioId === funcionarioId);
  const totalDias = registrosDoFuncionario.length;

  const valorDiarias = totalDias * funcionario.valorDiaria;
  const valorAdicionais = registrosDoFuncionario.reduce((soma, r) => soma + (r.valorAdicional ?? 0), 0);
  const valorTotal = valorDiarias + valorAdicionais;

  const fechamentos = await getFechamentos();
  const novoFechamento: DiariaFechamento = {
    id: gerarId(),
    funcionarioId,
    periodoInicio,
    periodoFim,
    totalDias,
    valorDiarias,
    valorAdicionais,
    valorTotal,
    status: 'pendente',
    fechadoEm: new Date().toISOString(),
  };

  // Vincula os registros ao fechamento
  const todosRegistros = await getRegistros();
  const todosRegistrosAtualizados = todosRegistros.map((r) => {
    if (registrosDoFuncionario.some((rd) => rd.id === r.id)) {
      return { ...r, fechamentoId: novoFechamento.id };
    }
    return r;
  });
  await setItem(KEYS.REGISTROS, todosRegistrosAtualizados);

  await setItem(KEYS.FECHAMENTOS, [...fechamentos, novoFechamento]);
  return novoFechamento;
}

export async function marcarComoPago(id: string): Promise<void> {
  const fechamentos = await getFechamentos();
  const atualizados = fechamentos.map((f) =>
    f.id === id ? { ...f, status: 'pago' as const } : f
  );
  await setItem(KEYS.FECHAMENTOS, atualizados);
}

export async function deleteFechamento(id: string): Promise<void> {
  // Desvincula registros deste fechamento
  const todosRegistros = await getRegistros();
  const todosRegistrosAtualizados = todosRegistros.map((r) =>
    r.fechamentoId === id ? { ...r, fechamentoId: undefined } : r
  );
  await setItem(KEYS.REGISTROS, todosRegistrosAtualizados);

  const fechamentos = await getFechamentos();
  await setItem(KEYS.FECHAMENTOS, fechamentos.filter((f) => f.id !== id));
}
