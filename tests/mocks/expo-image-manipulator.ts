import { arquivos, controle } from './memoria';

/** Formatos de saída, espelhando o expo-image-manipulator. */
export const SaveFormat = { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } as const;

interface OpcoesSalvamento {
  compress?: number;
  format?: string;
  base64?: boolean;
}

interface ResultadoImagem {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

function criarContexto(uri: string) {
  const contexto = {
    resize(_dimensao: { width?: number | null; height?: number | null }) {
      return contexto;
    },
    rotate(_graus: number) {
      return contexto;
    },
    flip(_eixo: 'vertical' | 'horizontal') {
      return contexto;
    },
    crop(_retangulo: { originX: number; originY: number; width: number; height: number }) {
      return contexto;
    },
    reset() {
      return contexto;
    },
    async renderAsync() {
      return {
        width: 800,
        height: 600,
        async saveAsync(_opcoes?: OpcoesSalvamento): Promise<ResultadoImagem> {
          controle.chamadasRedimensionamento += 1;
          if (controle.falharRedimensionamento) {
            throw new Error('Falha simulada ao redimensionar a imagem');
          }
          const original = arquivos.get(uri);
          const origem = original ? original.base64 : '';
          const novaUri = `${uri}?w=800`;
          // Simula a redução de tamanho obtida com o redimensionamento real.
          arquivos.set(novaUri, { base64: origem.slice(0, controle.limiteReduzido) });
          return { uri: novaUri, width: 800, height: 600, base64: '' };
        },
      };
    },
  };
  return contexto;
}

export const ImageManipulator = {
  manipulate(uri: string) {
    return criarContexto(uri);
  },
};

export async function manipulateAsync(uri: string): Promise<ResultadoImagem> {
  const render = await criarContexto(uri).renderAsync();
  return render.saveAsync();
}

export function useImageManipulator(uri: string) {
  return criarContexto(uri);
}
