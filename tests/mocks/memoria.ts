/**
 * Memória compartilhada entre os mocks de sistema de arquivos e de imagens.
 * Permite simular o armazenamento local do aparelho em testes de unidade,
 * carga, estresse e integridade.
 */
export interface ArquivoMemoria {
  base64: string;
}

export const arquivos = new Map<string, ArquivoMemoria>();

/** Metadados de controle dos mocks (falhas simuladas, chamadas, etc.). */
export const controle = {
  /** Número de chamadas ao redimensionamento de imagem. */
  chamadasRedimensionamento: 0,
  /** Se true, o redimensionamento lança erro (testa o fallback). */
  falharRedimensionamento: false,
  /** Tamanho máximo (caracteres) produzido pelo redimensionamento simulado. */
  limiteReduzido: 60_000,
};

export function limparMemoria(): void {
  arquivos.clear();
  controle.chamadasRedimensionamento = 0;
  controle.falharRedimensionamento = false;
  controle.limiteReduzido = 60_000;
}

export function semearArquivo(uri: string, base64: string): void {
  arquivos.set(uri, { base64 });
}

export function tamanhoEmBytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}
