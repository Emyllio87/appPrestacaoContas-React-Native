import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Abstração das dependências nativas usadas na geração de PDF.
 * Permite testar toda a pipeline (carga, estresse, integridade) sem dispositivo.
 */
export interface PdfRuntime {
  /** Pasta onde os arquivos gerados são gravados (ex.: file:///.../Documents/). */
  readonly documentDirectory: string;
  /** Renderiza HTML em PDF e devolve o conteúdo em base64 (ou null se indisponível). */
  printParaBase64(html: string): Promise<string | null>;
  /** Lê um arquivo de imagem como base64 puro (sem o prefixo data URI). */
  lerBase64(uri: string): Promise<string>;
  /** Informações do arquivo (existe/tamanho). */
  obterInfo(uri: string): Promise<{ exists: boolean; size?: number }>;
  /** Redimensiona e recomprime uma imagem, devolvendo a nova URI. */
  redimensionar(uri: string, largura: number, qualidade: number): Promise<string>;
  /** Grava base64 em disco. */
  gravarBase64(destino: string, base64: string): Promise<void>;
}

export const runtimePadrao: PdfRuntime = {
  documentDirectory: FileSystem.documentDirectory ?? '',

  async printParaBase64(html) {
    const resultado = await Print.printToFileAsync({ html, base64: true });
    return resultado?.base64 ?? null;
  },

  async lerBase64(uri) {
    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  },

  async obterInfo(uri) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return { exists: false };
      return { exists: true, size: 'size' in info && typeof info.size === 'number' ? info.size : undefined };
    } catch {
      return { exists: false };
    }
  },

  async redimensionar(uri, largura, qualidade) {
    const referencia = await ImageManipulator.ImageManipulator.manipulate(uri)
      .resize({ width: largura })
      .renderAsync();
    const salvo = await referencia.saveAsync({
      compress: qualidade,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return salvo.uri;
  },

  async gravarBase64(destino, base64) {
    await FileSystem.writeAsStringAsync(destino, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  },
};
