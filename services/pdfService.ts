import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Prestacao, Despesa, Categoria } from '../types';
import {
  agruparPorLimite,
  montarHtmlContinuacaoCupons,
  montarHtmlPrestacao,
} from './pdfCore';
import { carregarCupons, OpcoesCupons } from './pdfCupons';
import { runtimePadrao, PdfRuntime } from './pdfRuntime';
import { fundirPdfs, gravarPdf, renderizarPdf, OpcoesRender } from './pdfWriter';

/** Máximo de cupons por chamada nativa de renderização. */
export const MAX_CUPONS_PAR_PARTE = 30;
/** Tamanho máximo (bytes) do HTML com imagens por chamada nativa. */
export const MAX_BYTES_PAR_PARTE = 3_000_000;

export interface OpcoesPdfPrestacao extends OpcoesRender {
  runtime?: PdfRuntime;
  cupons?: OpcoesCupons;
  maxCuponsPorParte?: number;
  maxBytesPorParte?: number;
}

/**
 * Gera o PDF da prestação de contas.
 *
 * Estratégia para suportar muitos registros com retorno rápido e sem PDF em branco:
 * 1. cupons são redimensionados e carregados com concorrência limitada;
 * 2. a geração é fatiada em partes pequenas (limite de itens e de bytes);
 * 3. cada parte é validada (com nova tentativa em caso de falha);
 * 4. as partes são unidas em um único arquivo final validado.
 */
export async function gerarPdfPrestacao(
  prestacao: Prestacao,
  despesas: Despesa[],
  categorias: Categoria[],
  opcoes: OpcoesPdfPrestacao = {}
): Promise<string> {
  const runtime = opcoes.runtime ?? runtimePadrao;
  const cupons = await carregarCupons(despesas, runtime, opcoes.cupons);

  const grupos = agruparPorLimite(cupons, {
    maxItens: opcoes.maxCuponsPorParte ?? MAX_CUPONS_PAR_PARTE,
    maxBytes: opcoes.maxBytesPorParte ?? MAX_BYTES_PAR_PARTE,
    tamanhoDe: (cupom) => cupom.imagemBase64.length,
  });

  const totalPartes = Math.max(1, grupos.length);
  const render: OpcoesRender = {
    tentativas: opcoes.tentativas,
    intervaloMs: opcoes.intervaloMs,
  };

  const partes: string[] = [];
  for (let indice = 0; indice < totalPartes; indice += 1) {
    const grupo = grupos[indice] ?? [];
    const html =
      indice === 0
        ? montarHtmlPrestacao({
            prestacao,
            despesas,
            categorias,
            cupons: grupo,
            parte: 1,
            totalPartes,
          })
        : montarHtmlContinuacaoCupons({
            prestacao,
            cupons: grupo,
            parte: indice + 1,
            totalPartes,
          });

    partes.push(await renderizarPdf(html, runtime, render));
  }

  const consolidado = await fundirPdfs(partes);
  const destino = `${runtime.documentDirectory}prestacao_${prestacao.id}.pdf`;
  return gravarPdf(consolidado, destino, runtime);
}

export async function abrirPdf(uri: string): Promise<void> {
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      extra: { 'android.intent.extra.MIME_TYPE': 'application/pdf' },
    });
  } else {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Abrir PDF',
    });
  }
}

export async function compartilharPdf(uri: string): Promise<void> {
  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) return;

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Compartilhar prestação de contas',
  });
}
