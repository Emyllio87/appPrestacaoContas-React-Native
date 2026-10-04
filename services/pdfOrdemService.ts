import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { OrdemPagamento } from '../types';
import { montarHtmlOrdem } from './pdfCore';
import { runtimePadrao, PdfRuntime } from './pdfRuntime';
import { gravarPdf, renderizarPdf, OpcoesRender } from './pdfWriter';

export interface OpcoesPdfOrdem extends OpcoesRender {
  runtime?: PdfRuntime;
}

/**
 * Gera o PDF da ordem de pagamento.
 * A imagem é opcional: ordens salvas sem anexo geram o documento normalmente.
 */
export async function gerarPdfOrdem(
  ordem: OrdemPagamento,
  opcoes: OpcoesPdfOrdem = {}
): Promise<string> {
  const runtime = opcoes.runtime ?? runtimePadrao;
  const imagemDataUri = await carregarImagemOrdem(ordem, runtime);

  const html = montarHtmlOrdem(ordem, imagemDataUri);
  const base64 = await renderizarPdf(html, runtime, opcoes);

  const destino = `${runtime.documentDirectory}ordem_pagamento_${ordem.numero}.pdf`;
  return gravarPdf(base64, destino, runtime);
}

async function carregarImagemOrdem(
  ordem: OrdemPagamento,
  runtime: PdfRuntime
): Promise<string | null> {
  if (!ordem.imagemUri) return null;
  try {
    const info = await runtime.obterInfo(ordem.imagemUri);
    if (!info.exists) return null;

    const base64 = await runtime.lerBase64(ordem.imagemUri);
    if (!base64) return null;

    const extensao = ordem.imagemUri.split('.').pop()?.toLowerCase() ?? 'jpeg';
    const mime = extensao === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function abrirPdfOrdem(uri: string): Promise<void> {
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

export async function compartilharPdfOrdem(uri: string): Promise<void> {
  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) return;

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Compartilhar ordem de pagamento',
  });
}
