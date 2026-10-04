export interface Categoria {
  id: string;
  nome: string;
}

export type StatusPrestacao = 'aberta' | 'fechada';
export type TipoSaldo = 'caixa' | 'reembolso';

export interface Prestacao {
  id: string;
  descricao: string;
  valorRecebido: number;
  data: string; // ISO - data de criação
  status: StatusPrestacao;
  saldoTipo?: TipoSaldo;
  saldoValor?: number;
  dataFechamento?: string;
}

export interface Despesa {
  id: string;
  prestacaoId: string;
  descricao: string;
  categoriaId: string;
  valor: number;
  data: string; // ISO
  cupomUri: string;
}

// ---------- Diárias ----------

export interface DiariaFuncionario {
  id: string;
  nome: string;
  funcao: string;
  valorDiaria: number;
  telefone: string;
  tipoChavePix: TipoChavePix;
  pixInfo: string;
  criadoEm: string; // ISO
}

export interface DiariaRegistro {
  id: string;
  funcionarioId: string;
  data: string; // ISO - dia trabalhado
  observacao?: string;
  valorAdicional: number;
  fechamentoId?: string; // vincula ao fechamento quando já foi pago/fechado
  criadoEm: string; // ISO
}

export type StatusFechamento = 'pendente' | 'pago';

export interface DiariaFechamento {
  id: string;
  funcionarioId: string;
  periodoInicio: string; // ISO
  periodoFim: string; // ISO
  totalDias: number;
  valorDiarias: number;
  valorAdicionais: number;
  valorTotal: number;
  status: StatusFechamento;
  fechadoEm: string; // ISO
}

// ---------- Ordem de Pagamento ----------

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface OrdemPagamento {
  id: string;
  numero: string; // ex: OP-001
  fornecedor: string;
  tipoChavePix: TipoChavePix;
  pixInfo: string;
  valor: number;
  assunto: string;
  /** Opcional: a ordem pode ser salva sem imagem anexada. */
  imagemUri?: string;
  status: 'pendente' | 'autorizado';
  criadoEm: string; // ISO
}

export interface ItemCotacao {
  id: string;
  material: string;
  unidade: string;
  quantidade: string;
  observacao: string;
}

export type StatusPedido = 'pendente' | 'autorizado';

export interface PedidoCotacao {
  id: string;
  numero: string;
  assunto: string;
  data: string; // ISO
  status: StatusPedido;
  itens: ItemCotacao[];
  criadoEm: string; // ISO
}
