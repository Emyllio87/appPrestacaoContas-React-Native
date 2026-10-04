import { arquivos, controle, semearArquivo, tamanhoEmBytes } from './memoria';

export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;

export const documentDirectory = 'file:///app/documents/';
export const cacheDirectory = 'file:///app/cache/';

export interface FileInfo {
  exists: boolean;
  uri?: string;
  size?: number;
  isDirectory?: boolean;
}

export async function getInfoAsync(uri: string): Promise<FileInfo> {
  const arquivo = arquivos.get(uri);
  if (!arquivo) return { exists: false, uri, isDirectory: false };
  return { exists: true, uri, size: tamanhoEmBytes(arquivo.base64), isDirectory: false };
}

export async function readAsStringAsync(uri: string, options?: { encoding?: string }): Promise<string> {
  const arquivo = arquivos.get(uri);
  if (!arquivo) throw new Error(`FileNotFound: ${uri}`);
  return arquivo.base64;
}

export async function writeAsStringAsync(
  uri: string,
  conteudo: string,
  _options?: { encoding?: string }
): Promise<void> {
  arquivos.set(uri, { base64: conteudo });
}

export async function deleteAsync(uri: string): Promise<void> {
  arquivos.delete(uri);
}

export async function getContentUriAsync(uri: string): Promise<string> {
  return uri;
}

export async function makeDirectoryAsync(uri: string): Promise<void> {
  arquivos.set(`${uri}/.dir`, { base64: '' });
}

export async function readDirectoryAsync(uri: string): Promise<string[]> {
  const prefixo = uri.endsWith('/') ? uri : `${uri}/`;
  return [...arquivos.keys()].filter((chave) => chave.startsWith(prefixo));
}

export async function copyAsync(origem: string, destino: string): Promise<void> {
  const arquivo = arquivos.get(origem);
  if (!arquivo) throw new Error(`FileNotFound: ${origem}`);
  arquivos.set(destino, { base64: arquivo.base64 });
}

// Expõe utilitários para os testes sem quebrar a API pública do expo-file-system.
export const __memoria = { arquivos, semearArquivo, controle };
