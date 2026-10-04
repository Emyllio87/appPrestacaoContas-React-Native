import {
  formatarCNPJ,
  formatarCPF,
  formatarMoeda,
  formatarMoedaInput,
  formatarTelefone,
  parsearMoeda,
  valorMoedaValido,
} from '../../utils/formatacao';

describe('formatacao — moeda', () => {
  test('formata no padrão brasileiro', () => {
    expect(formatarMoeda(1234.5)).toBe('R$ 1.234,50');
    expect(formatarMoeda(0)).toBe('R$ 0,00');
    expect(formatarMoeda(-1000)).toBe('-R$ 1.000,00');
  });

  test('formata entrada em tempo real', () => {
    expect(formatarMoedaInput('123456')).toBe('1.234,56');
    expect(formatarMoedaInput('1')).toBe('0,01');
    expect(formatarMoedaInput('')).toBe('');
  });

  test('converte texto em número', () => {
    expect(parsearMoeda('1.234,56')).toBe(1234.56);
    expect(parsearMoeda('1234,56')).toBe(1234.56);
    expect(parsearMoeda('1234.56')).toBe(1234.56);
    expect(parsearMoeda('R$ 10,00')).toBe(10);
  });

  test('valida valores monetários', () => {
    expect(valorMoedaValido('10,00')).toBe(true);
    expect(valorMoedaValido('0,00')).toBe(false);
    expect(valorMoedaValido('abc')).toBe(false);
  });
});

describe('formatacao — máscaras', () => {
  test('telefone', () => {
    expect(formatarTelefone('67999998888')).toBe('(67) 99999-8888');
    expect(formatarTelefone('6733334444')).toBe('(67) 3333-4444');
  });

  test('CPF e CNPJ', () => {
    expect(formatarCPF('12345678901')).toBe('123.456.789-01');
    expect(formatarCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });
});
