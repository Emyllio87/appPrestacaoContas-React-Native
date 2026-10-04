import { Categoria, Despesa, Prestacao, OrdemPagamento, TipoChavePix } from '../types';
import { formatarMoeda } from '../utils/formatacao';

/** Erro lançado quando a geração/ar gravacão do PDF falha de forma recuperável. */
export class PdfGenerationError extends Error {
  readonly detalhe?: unknown;

  constructor(mensagem: string, detalhe?: unknown) {
    super(mensagem);
    this.name = 'PdfGenerationError';
    this.detalhe = detalhe;
  }
}

/** Assinatura "%PDF-" codificada em base64. */
export const ASSINATURA_PDF_BASE64 = 'JVBERi';

/** Tamanho mínimo (em caracteres base64) para considerar um PDF válido. */
export const TAMANHO_MINIMO_PDF_BASE64 = 512;

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapa texto para uso seguro dentro de HTML.
 * Descrições do usuário com "<", "&" ou tags quebravam o documento e geravam páginas em branco.
 */
export function escapeHtml(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).replace(/[&<>"']/g, (c) => ENTIDADES[c] ?? c);
}

const TABELA_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Converte bytes em base64 sem depender de Buffer (ausente no Hermes/React Native).
 * Necessário para unir PDFs gerados pela camada nativa.
 */
export function bytesParaBase64(bytes: Uint8Array): string {
  const partes: string[] = [];
  const total = bytes.length;
  for (let i = 0; i < total; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < total ? bytes[i + 1] : undefined;
    const b2 = i + 2 < total ? bytes[i + 2] : undefined;
    partes.push(TABELA_BASE64[b0 >> 2]);
    partes.push(TABELA_BASE64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]);
    partes.push(b1 === undefined ? '=' : TABELA_BASE64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]);
    partes.push(b2 === undefined ? '=' : TABELA_BASE64[b2 & 63]);
  }
  return partes.join('');
}

/** Valida se uma string base64 representa um PDF não vazio e íntegro. */
export function validarPdfBase64(base64: string | null | undefined): boolean {
  if (typeof base64 !== 'string') return false;
  const limpo = base64.replace(/^[\s﻿]+/, '');
  if (limpo.length < TAMANHO_MINIMO_PDF_BASE64) return false;
  return limpo.startsWith(ASSINATURA_PDF_BASE64);
}

/** Divide uma lista em blocos de tamanho fixo. */
export function paginar<T>(itens: readonly T[], tamanho: number): T[][] {
  const porBloco = Math.max(1, Math.floor(tamanho));
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += porBloco) {
    blocos.push(itens.slice(i, i + porBloco));
  }
  return blocos;
}

/**
 * Mapeia itens com número máximo de execuções simultâneas.
 * Mantém a ordem dos resultados e nunca ultrapassa o limite de concorrência,
 * o que evita estouro de memória quando há muitos cupons.
 */
export async function mapComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>
): Promise<R[]> {
  const porVez = Math.max(1, Math.floor(limite));
  const resultados = new Array<R>(itens.length);
  let cursor = 0;

  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const indice = cursor;
      cursor += 1;
      if (indice >= itens.length) return;
      resultados[indice] = await fn(itens[indice], indice);
    }
  };

  const total = Math.min(porVez, itens.length);
  const trabalhadores: Promise<void>[] = [];
  for (let i = 0; i < total; i += 1) trabalhadores.push(trabalhador());
  await Promise.all(trabalhadores);
  return resultados;
}

export interface LimiteAgrupamento {
  maxItens: number;
  maxBytes: number;
  tamanhoDe: (item: any) => number;
}

/**
 * Agrupa itens respeitando limite de quantidade e de bytes.
 * Usado para fatiar a geração do PDF em chamadas nativas pequenas e rápidas.
 */
export function agruparPorLimite<T>(itens: readonly T[], limite: LimiteAgrupamento): T[][] {
  const maxItens = Math.max(1, Math.floor(limite.maxItens));
  const maxBytes = Math.max(1, Math.floor(limite.maxBytes));
  const grupos: T[][] = [];
  let atual: T[] = [];
  let bytes = 0;

  for (const item of itens) {
    const tamanho = Math.max(0, limite.tamanhoDe(item));
    const estoura = atual.length > 0 && (atual.length >= maxItens || bytes + tamanho > maxBytes);
    if (estoura) {
      grupos.push(atual);
      atual = [];
      bytes = 0;
    }
    atual.push(item);
    bytes += tamanho;
  }
  if (atual.length > 0) grupos.push(atual);
  return grupos;
}

/**
 * Soma valores financeiros ignorando entradas não numéricas/não finitas.
 * Impede que um registro corrompido transforme o total do relatório em NaN.
 */
export function somarValores(valores: readonly number[]): number {
  return valores.reduce<number>((acc, valor) => {
    return typeof valor === 'number' && Number.isFinite(valor) ? acc + valor : acc;
  }, 0);
}

export interface CupomHtml {
  /** Número da despesa na tabela (1-based), usado para rotular o cupom. */
  numero: number;
  descricao: string;
  data: string;
  valor: number;
  /** data URI (data:image/jpeg;base64,...) pronto para o HTML. */
  imagemBase64: string;
}

const LABELS_CHAVE_PIX: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
};

function formatarDataHora(data: Date): string {
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataFormatada} às ${horaFormatada}`;
}

const ESTILOS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  html, body { font-family: Helvetica, Arial, sans-serif; color: #1A1A1A; }
  .pagina { padding: 36px 40px; }
  .header { text-align: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 14px; margin-bottom: 22px; }
  .header .titulo { font-size: 20px; letter-spacing: 0.5px; }
  .header .referencia { font-size: 14px; color: #1A1A1A; margin-top: 4px; }
  .header .subtitulo { font-size: 12px; color: #757575; margin-top: 4px; }
  .header .criacao { font-size: 12px; color: #757575; margin-top: 4px; }
  .header .gerado { font-size: 9px; color: #9E9E9E; margin-top: 6px; }
  .dados h2, .itens-titulo { font-size: 14px; color: #1A1A1A; border-bottom: 1px solid #E0E0E0; padding-bottom: 8px; margin-bottom: 12px; }
  .dados table { width: 100%; border-collapse: collapse; }
  .dados td { padding: 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; }
  .dados .campo-label { color: #757575; width: 180px; }
  .itens-titulo { margin-top: 22px; }
  .tabela { width: 100%; border-collapse: collapse; }
  .tabela thead { display: table-header-group; }
  .tabela th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #1A1A1A; padding: 8px 10px; text-align: left; font-weight: bold; border-bottom: 1px solid #D0D0D0; }
  .tabela th:nth-child(1) { text-align: center; width: 30px; }
  .tabela td { font-size: 12px; padding: 10px; border-bottom: 1px solid #F0F0F0; }
  .tabela tr { page-break-inside: avoid; }
  .dados, .itens-titulo { page-break-inside: avoid; }
  .cupons-secao { margin-top: 22px; page-break-before: auto; }
  .cupons { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .cupons tr { page-break-inside: avoid; }
  .cupons td { width: 33.33%; padding: 6px; vertical-align: top; text-align: center; page-break-inside: avoid; }
  .cupon-titulo { font-size: 10px; font-weight: bold; color: #1565C0; margin-bottom: 2px; overflow-wrap: break-word; }
  .cupon-meta { font-size: 9px; color: #757575; margin-bottom: 2px; }
  .cupon-img { width: 100%; height: 150px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px; }
`;

function montarTabelaDespesas(despesas: Despesa[], nomeCategoria: (id: string) => string): string {
  const linhas = despesas
    .map(
      (d, i) => `
      <tr>
        <td style="text-align:center;font-weight:bold;">${i + 1}</td>
        <td>${escapeHtml(d.descricao)}</td>
        <td>${escapeHtml(nomeCategoria(d.categoriaId))}</td>
        <td>${escapeHtml(new Date(d.data).toLocaleDateString('pt-BR'))}</td>
        <td style="text-align:right">${escapeHtml(formatarMoeda(d.valor))}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="itens-titulo">Despesas</div>
    <table class="tabela">
      <thead>
        <tr>
          <th>#</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th>Data</th>
          <th style="text-align:right">Valor</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

/** Monta o HTML do cupom. Retorna string vazia quando a imagem não pôde ser lida. */
function montarCelulaCupom(cupom: CupomHtml): string {
  if (!cupom.imagemBase64) return '';
  return `
    <td class="cupon">
      <div class="cupon-titulo">#${cupom.numero} - ${escapeHtml(cupom.descricao)}</div>
      <div class="cupon-meta">${escapeHtml(cupom.data)} · ${escapeHtml(formatarMoeda(cupom.valor))}</div>
      <img src="${cupom.imagemBase64}" class="cupon-img" />
    </td>`;
}

/**
 * Monta a grade de cupons usando tabela (e não flex).
 * O motor de impressão fragmenta mal containers flex: era a causa das páginas em branco
 * na seção de cupons quando havia muitos registros.
 */
function montarGradeCupons(cupons: CupomHtml[]): string {
  const celulas = cupons.map(montarCelulaCupom).filter(Boolean);
  if (celulas.length === 0) return '';

  const linhas: string[] = [];
  for (let i = 0; i < celulas.length; i += 3) {
    const trio = celulas.slice(i, i + 3);
    const preenchimento = 3 - trio.length;
    const vazias = preenchimento > 0 ? '<td class="cupon"></td>'.repeat(preenchimento) : '';
    linhas.push(`<tr>${trio.join('')}${vazias}</tr>`);
  }

  return `
    <div class="cupons-secao">
      <div class="itens-titulo">Cupons anexados</div>
      <table class="cupons"><tbody>${linhas.join('')}</tbody></table>
    </div>`;
}

export interface OpcoesHtmlPrestacao {
  prestacao: Prestacao;
  despesas: Despesa[];
  categorias: Categoria[];
  cupons: CupomHtml[];
  parte: number;
  totalPartes: number;
  geradoEm?: string;
}

/** HTML da primeira parte: capa + resumo financeiro + tabela de despesas + primeiros cupons. */
export function montarHtmlPrestacao(opcoes: OpcoesHtmlPrestacao): string {
  const { prestacao, despesas, categorias, cupons, parte, totalPartes } = opcoes;
  const nomeCategoria = (id: string) => categorias.find((c) => c.id === id)?.nome ?? 'Sem categoria';
  const totalGasto = somarValores(despesas.map((d) => d.valor));
  const saldoLabel = prestacao.saldoTipo === 'reembolso' ? 'Valor a Reembolsar' : 'Saldo caixa';
  const saldoValor = prestacao.saldoValor ?? 0;
  const dataCriacao = new Date(prestacao.data).toLocaleDateString('pt-BR');
  const dataFechamentoHtml = prestacao.dataFechamento
    ? ` · Fechada em ${escapeHtml(new Date(prestacao.dataFechamento).toLocaleDateString('pt-BR'))}`
    : '';
  const dataGeracao = formatarDataHora(opcoes.geradoEm ? new Date(opcoes.geradoEm) : new Date());
  const indicadorPartes = totalPartes > 1 ? ` (parte ${parte} de ${totalPartes})` : '';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>${ESTILOS}</style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Relatório de Prestação de Contas${escapeHtml(indicadorPartes)}</div>
            <div class="referencia">${escapeHtml(prestacao.descricao)}</div>
            <div class="criacao">Criada em ${escapeHtml(dataCriacao)}${dataFechamentoHtml}</div>
            <div class="gerado">Relatório gerado em ${escapeHtml(dataGeracao)}</div>
          </div>

          <div class="dados">
            <h2>Resumo Financeiro</h2>
            <table>
              <tr>
                <td class="campo-label">Valor recebido</td>
                <td>${escapeHtml(formatarMoeda(prestacao.valorRecebido))}</td>
              </tr>
              <tr>
                <td class="campo-label">Total gasto</td>
                <td>${escapeHtml(formatarMoeda(totalGasto))}</td>
              </tr>
              <tr>
                <td class="campo-label">${escapeHtml(saldoLabel)}</td>
                <td>${escapeHtml(formatarMoeda(saldoValor))}</td>
              </tr>
            </table>
          </div>

          ${montarTabelaDespesas(despesas, nomeCategoria)}
          ${montarGradeCupons(cupons)}
        </div>
      </body>
    </html>
  `;
}

export interface OpcoesHtmlContinuacao {
  prestacao: Prestacao;
  cupons: CupomHtml[];
  parte: number;
  totalPartes: number;
  geradoEm?: string;
}

/** HTML das partes seguintes: apenas o cabeçalho + continuação dos cupons. */
export function montarHtmlContinuacaoCupons(opcoes: OpcoesHtmlContinuacao): string {
  const { prestacao, cupons, parte, totalPartes } = opcoes;
  const dataGeracao = formatarDataHora(opcoes.geradoEm ? new Date(opcoes.geradoEm) : new Date());

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>${ESTILOS}</style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Relatório de Prestação de Contas (parte ${parte} de ${totalPartes})</div>
            <div class="referencia">${escapeHtml(prestacao.descricao)}</div>
            <div class="subtitulo">Cupons anexados — continuação</div>
            <div class="gerado">Relatório gerado em ${escapeHtml(dataGeracao)}</div>
          </div>
          ${montarGradeCupons(cupons)}
        </div>
      </body>
    </html>
  `;
}

/** HTML da ordem de pagamento (funciona também sem imagem anexada). */
export function montarHtmlOrdem(ordem: OrdemPagamento, imagemDataUri: string | null): string {
  const dataCriacao = formatarDataHora(new Date(ordem.criadoEm));
  const dataGeracao = formatarDataHora(new Date());

  const imagemHtml = imagemDataUri
    ? `
      <div class="imagem-section">
        <h2>Imagem do Pedido</h2>
        <div class="imagem-container">
          <img src="${imagemDataUri}" class="imagem" />
        </div>
      </div>`
    : '';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          html, body { font-family: Helvetica, Arial, sans-serif; color: #1A1A1A; }
          .pagina { padding: 40px 44px; }
          .header { text-align: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 16px; margin-bottom: 28px; }
          .header .titulo { font-size: 20px; letter-spacing: 0.5px; }
          .header .numero { font-size: 12px; color: #757575; margin-top: 4px; }
          .header .gerado { font-size: 9px; color: #9E9E9E; margin-top: 6px; }
          .dados h2, .imagem-section h2 { font-size: 14px; color: #1A1A1A; border-bottom: 1px solid #E0E0E0; padding-bottom: 8px; margin-bottom: 12px; }
          .dados table { width: 100%; border-collapse: collapse; }
          .dados td { padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; }
          .dados .campo-label { color: #757575; width: 180px; }
          .imagem-section { margin-top: 24px; }
          .imagem-container { width: 100%; text-align: center; }
          .imagem { max-width: 100%; max-height: 480px; object-fit: contain; border: 1px solid #E0E0E0; border-radius: 4px; }
          .footer { text-align: center; border-top: 1px solid #F0F0F0; padding-top: 10px; font-size: 8px; color: #BDBDBD; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Ordem de Pagamento</div>
            <div class="numero">Nº ${escapeHtml(ordem.numero)}</div>
            <div class="gerado">Gerado em ${escapeHtml(dataGeracao)}</div>
          </div>

          <div class="dados">
            <h2>Dados do Pagamento</h2>
            <table>
              <tr><td class="campo-label">Número</td><td>${escapeHtml(ordem.numero)}</td></tr>
              <tr><td class="campo-label">Assunto</td><td>${escapeHtml(ordem.assunto)}</td></tr>
              <tr><td class="campo-label">Fornecedor</td><td>${escapeHtml(ordem.fornecedor)}</td></tr>
              <tr><td class="campo-label">Valor</td><td>${escapeHtml(formatarMoeda(ordem.valor))}</td></tr>
              <tr><td class="campo-label">Tipo chave PIX</td><td>${escapeHtml(LABELS_CHAVE_PIX[ordem.tipoChavePix] ?? ordem.tipoChavePix)}</td></tr>
              <tr><td class="campo-label">Chave PIX</td><td>${escapeHtml(ordem.pixInfo)}</td></tr>
              <tr><td class="campo-label">Data de criação</td><td>${escapeHtml(dataCriacao)}</td></tr>
            </table>
          </div>

          ${imagemHtml}

          <div class="footer">Documento gerado automaticamente · ${escapeHtml(dataGeracao)}</div>
        </div>
      </body>
    </html>
  `;
}
