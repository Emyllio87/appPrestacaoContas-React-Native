import { PdfGenerationError, bytesParaBase64, validarPdfBase64 } from './pdfCore';
import { PdfRuntime, runtimePadrao } from './pdfRuntime';

export interface OpcoesRender {
  /** Total de tentativas (1 = sem repetição). */
  tentativas?: number;
  /** Espera entre tentativas, para liberar memória nativa. */
  intervaloMs?: number;
}

function aguardar(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Renderiza HTML em PDF com validação de saída e nova tentativa em caso de falha.
 * Nunca devolve um PDF vazio: se a nativa retornar base64 ausente/corrompido, lança erro claro.
 */
export async function renderizarPdf(
  html: string,
  runtime: PdfRuntime,
  opcoes: OpcoesRender = {}
): Promise<string> {
  const tentativas = Math.max(1, Math.floor(opcoes.tentativas ?? 3));
  const intervaloMs = opcoes.intervaloMs ?? 120;
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
    if (tentativa > 0) await aguardar(intervaloMs);
    try {
      const base64 = await runtime.printParaBase64(html);
      if (validarPdfBase64(base64)) return base64 as string;
      ultimoErro = new PdfGenerationError('A geração do PDF retornou um arquivo vazio.');
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  if (ultimoErro instanceof PdfGenerationError) throw ultimoErro;
  throw new PdfGenerationError('Não foi possível gerar o PDF.', ultimoErro);
}

/** Funde várias partes em um único PDF. Com uma parte, devolve o original. */
export async function fundirPdfs(base64s: string[]): Promise<string> {
  if (base64s.length === 0) {
    throw new PdfGenerationError('Nenhum PDF para gravar.');
  }
  if (base64s.length === 1) return base64s[0];

  // Carregado sob demanda para não pesar na abertura do app.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PDFDocument } = require('pdf-lib') as typeof import('pdf-lib');

  try {
    const destino = await PDFDocument.create();
    for (const parte of base64s) {
      const documento = await PDFDocument.load(parte, { ignoreEncryption: true });
      const paginas = await destino.copyPages(documento, documento.getPageIndices());
      for (const pagina of paginas) destino.addPage(pagina);
    }
    const bytes = await destino.save();
    const base64 = bytesParaBase64(bytes);
    if (!validarPdfBase64(base64)) {
      throw new PdfGenerationError('A união dos PDFs gerou um arquivo inválido.');
    }
    return base64;
  } catch (erro) {
    if (erro instanceof PdfGenerationError) throw erro;
    throw new PdfGenerationError('Não foi possível unir as partes do PDF.', erro);
  }
}

/** Grava o PDF validando o conteúdo. Dispara erro em vez de gravar arquivo vazio. */
export async function gravarPdf(base64: string, destino: string, runtime: PdfRuntime): Promise<string> {
  if (!validarPdfBase64(base64)) {
    throw new PdfGenerationError('O PDF gerado está vazio ou corrompido e não pode ser salvo.');
  }
  await runtime.gravarBase64(destino, base64);
  return destino;
}

/**
 * Atalho: renderiza o HTML com validação/repetição e grava o arquivo.
 * Substitui o padrão antigo `printToFileAsync` + `base64 ?? ''`, que gravava
 * arquivos vazios quando a nativa falhava.
 */
export async function gerarArquivoPdf(
  html: string,
  nomeArquivo: string,
  runtime: PdfRuntime = runtimePadrao,
  opcoes: OpcoesRender = {}
): Promise<string> {
  const base64 = await renderizarPdf(html, runtime, opcoes);
  return gravarPdf(base64, `${runtime.documentDirectory}${nomeArquivo}`, runtime);
}
