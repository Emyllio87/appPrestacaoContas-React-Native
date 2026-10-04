import { PDFDocument } from 'pdf-lib';

/**
 * Mock do expo-print.
 * Gera PDFs reais (via pdf-lib) para exercitar validação, fatiamento e fusão,
 * e permite simular as falhas da camada nativa que geravam PDF em branco.
 */

export interface ResultadoPrint {
  uri: string;
  numberOfPages: number;
  base64?: string;
}

type TipoFalha = 'vazio' | 'erro';

export const estado = {
  chamadas: [] as string[],
  falhasRestantes: 0,
  tipoFalha: 'vazio' as TipoFalha,
  /** Quando definido, apenas os HTMLs que satisfazem o filtro falham. */
  filtroFalha: null as null | ((html: string) => boolean),
  /** Tamanho máximo de HTML aceito por chamada (para asserções de carga). */
  maiorHtml: 0,
};

export function resetPrint(): void {
  estado.chamadas = [];
  estado.falhasRestantes = 0;
  estado.tipoFalha = 'vazio';
  estado.filtroFalha = null;
  estado.maiorHtml = 0;
}

export function prepararFalhas(quantidade: number, tipo: TipoFalha = 'vazio'): void {
  estado.falhasRestantes = quantidade;
  estado.tipoFalha = tipo;
  estado.filtroFalha = null;
}

/** Falha apenas nas chamadas cujo HTML satisfaz o filtro (ex.: uma parte específica). */
export function prepararFalhaSeletiva(
  filtro: (html: string) => boolean,
  tipo: TipoFalha = 'vazio'
): void {
  estado.filtroFalha = filtro;
  estado.tipoFalha = tipo;
}

export async function printToFileAsync(options: { html?: string; base64?: boolean } = {}): Promise<ResultadoPrint> {
  const html = options.html ?? '';
  estado.chamadas.push(html);
  estado.maiorHtml = Math.max(estado.maiorHtml, html.length);

  const falhaSeletiva = estado.filtroFalha !== null && estado.filtroFalha(html);
  if (falhaSeletiva || estado.falhasRestantes > 0) {
    if (!falhaSeletiva) estado.falhasRestantes -= 1;
    if (estado.tipoFalha === 'erro') {
      throw new Error('Erro nativo simulado do print');
    }
    // Simula o cenário real: o WebView não renderizou e a nativa devolve sem base64.
    return { uri: 'file:///app/cache/Print/vazio.pdf', numberOfPages: 1, base64: undefined };
  }

  const paginas = Math.max(1, Math.ceil(html.length / 45_000));
  const documento = await PDFDocument.create();
  for (let i = 0; i < paginas; i += 1) documento.addPage([595, 842]);
  const bytes = await documento.save();

  return {
    uri: `file:///app/cache/Print/${estado.chamadas.length}.pdf`,
    numberOfPages: paginas,
    base64: options.base64 === false ? undefined : Buffer.from(bytes).toString('base64'),
  };
}

export async function printAsync(_options: { uri?: string; html?: string }): Promise<void> {
  // Impressão simulada: sempre conclui.
}

export const Orientation = { portrait: 'portrait', landscape: 'landscape' } as const;
