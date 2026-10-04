const banco = new Map<string, string>();

function obter(chave: string): string | null {
  return banco.has(chave) ? (banco.get(chave) as string) : null;
}

const AsyncStorage = {
  async getItem(chave: string): Promise<string | null> {
    return obter(chave);
  },
  async setItem(chave: string, valor: string): Promise<void> {
    banco.set(chave, valor);
  },
  async removeItem(chave: string): Promise<void> {
    banco.delete(chave);
  },
  async clear(): Promise<void> {
    banco.clear();
  },
  async getAllKeys(): Promise<string[]> {
    return [...banco.keys()];
  },
  async multiGet(chaves: string[]): Promise<[string, string | null][]> {
    return chaves.map((chave) => [chave, obter(chave)]);
  },
  async multiSet(pares: [string, string][]): Promise<void> {
    for (const [chave, valor] of pares) banco.set(chave, valor);
  },
  async multiRemove(chaves: string[]): Promise<void> {
    for (const chave of chaves) banco.delete(chave);
  },
  __banco: banco,
  __reset(): void {
    banco.clear();
  },
};

export default AsyncStorage;
