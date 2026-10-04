import { Despesa } from '../types';
import { CupomHtml, mapComLimite } from './pdfCore';
import { PdfRuntime } from './pdfRuntime';

export interface OpcoesCupons {
  /** Número máximo de imagens processadas ao mesmo tempo. */
  concorrencia?: number;
  /** Largura máxima (px) ao redimensionar cupons grandes. */
  larguraMax?: number;
  /** Qualidade JPEG (0..1) ao redimensionar. */
  qualidade?: number;
  /** Acima deste tamanho em bytes a imagem é redimensionada antes de ir para o HTML. */
  limiteBytesOriginal?: number;
}

export const PADRAO_CUPONS: Required<OpcoesCupons> = {
  concorrencia: 3,
  larguraMax: 800,
  qualidade: 0.6,
  limiteBytesOriginal: 150_000,
};

async function otimizarImagem(
  uri: string,
  info: { exists: boolean; size?: number },
  cfg: Required<OpcoesCupons>,
  runtime: PdfRuntime
): Promise<string> {
  if (typeof info.size !== 'number' || info.size <= cfg.limiteBytesOriginal) return uri;
  try {
    return await runtime.redimensionar(uri, cfg.larguraMax, cfg.qualidade);
  } catch {
    // Se o redimensionamento falhar, usa a imagem original.
    return uri;
  }
}

/**
 * Carrega os cupons das despesas convertendo-os para data URI.
 * - processa em lotes com concorrência limitada (evita estouro de memória);
 * - redimensiona cupons grandes (HTML menor => renderização rápida e sem PDF em branco);
 * - ignora silenciosamente cupons inexistentes/corrompidos, sem derrubar o relatório.
 */
export async function carregarCupons(
  despesas: readonly Despesa[],
  runtime: PdfRuntime,
  opcoes: OpcoesCupons = {}
): Promise<CupomHtml[]> {
  const cfg: Required<OpcoesCupons> = { ...PADRAO_CUPONS, ...opcoes };
  const numerados = despesas.map((despesa, indice) => ({ despesa, numero: indice + 1 }));

  const resultados = await mapComLimite(numerados, cfg.concorrencia, async ({ despesa, numero }) => {
    try {
      const uri = despesa.cupomUri;
      if (!uri) return null;

      const info = await runtime.obterInfo(uri);
      if (!info.exists) return null;

      const uriFinal = await otimizarImagem(uri, info, cfg, runtime);
      const base64 = await runtime.lerBase64(uriFinal);
      if (!base64) return null;

      return {
        numero,
        descricao: despesa.descricao,
        data: new Date(despesa.data).toLocaleDateString('pt-BR'),
        valor: despesa.valor,
        imagemBase64: `data:image/jpeg;base64,${base64}`,
      } satisfies CupomHtml;
    } catch {
      return null;
    }
  });

  return resultados.filter((cupom): cupom is CupomHtml => cupom !== null);
}
