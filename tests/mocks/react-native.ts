type Plataforma = 'ios' | 'android' | 'web';

export const Platform = {
  OS: 'android' as Plataforma,
  select<T>(especificacao: { android?: T; ios?: T; web?: T; default?: T }): T | undefined {
    if (Platform.OS === 'android' && especificacao.android !== undefined) return especificacao.android;
    if (Platform.OS === 'ios' && especificacao.ios !== undefined) return especificacao.ios;
    if (Platform.OS === 'web' && especificacao.web !== undefined) return especificacao.web;
    return especificacao.default;
  },
};

export const StyleSheet = {
  create<T extends Record<string, unknown>>(estilos: T): T {
    return estilos;
  },
};

export default { Platform, StyleSheet };
