import {
  addOrdemPagamento,
  deleteOrdemPagamento,
  getOrdensPagamento,
  obterProximoNumeroOrdem,
  updateOrdemPagamento,
} from '../../storage/storageOrdens';
import { resetAmbiente } from '../helpers/fixtures';

async function criarOrdem(overrides: Partial<Parameters<typeof addOrdemPagamento>[0]> = {}) {
  return addOrdemPagamento({
    fornecedor: 'Fornecedor',
    tipoChavePix: 'cpf',
    pixInfo: '12345678900',
    valor: 100,
    assunto: 'Assunto',
    ...overrides,
  });
}

describe('storageOrdens — ordens de pagamento', () => {
  beforeEach(() => resetAmbiente());

  test('salva ordem SEM imagem anexada', async () => {
    const ordem = await criarOrdem({ imagemUri: '' });

    expect(ordem.imagemUri).toBe('');
    expect(ordem.status).toBe('pendente');
    expect(ordem.numero).toBe('OP-001');

    const lista = await getOrdensPagamento();
    expect(lista).toHaveLength(1);
    expect(lista[0].imagemUri).toBe('');
  });

  test('salva ordem sem informar imagem (campo opcional)', async () => {
    const ordem = await addOrdemPagamento({
      fornecedor: 'Fornecedor',
      tipoChavePix: 'cnpj',
      pixInfo: '11222333000181',
      valor: 50,
      assunto: 'Sem anexo',
    });

    expect(ordem.imagemUri).toBe('');
  });

  test('salva ordem COM imagem anexada', async () => {
    const ordem = await criarOrdem({ imagemUri: 'file:///app/cache/pedido.jpg' });
    expect(ordem.imagemUri).toBe('file:///app/cache/pedido.jpg');
  });

  test('atribui números sequenciais sem repetição após exclusões', async () => {
    const a = await criarOrdem();
    const b = await criarOrdem();
    const c = await criarOrdem();

    expect([a.numero, b.numero, c.numero]).toEqual(['OP-001', 'OP-002', 'OP-003']);

    await deleteOrdemPagamento(b.id);

    const d = await criarOrdem();
    expect(d.numero).toBe('OP-004');

    const numeros = (await getOrdensPagamento()).map((o) => o.numero);
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  test('obterProximoNumeroOrdem reflete o maior número usado', async () => {
    expect(await obterProximoNumeroOrdem()).toBe('OP-001');
    await criarOrdem();
    expect(await obterProximoNumeroOrdem()).toBe('OP-002');
    await criarOrdem();
    expect(await obterProximoNumeroOrdem()).toBe('OP-003');
  });

  test('atualiza campos e permite remover a imagem', async () => {
    const ordem = await criarOrdem({ imagemUri: 'file:///app/cache/x.jpg' });

    await updateOrdemPagamento(ordem.id, { valor: 999, imagemUri: '' });
    const [atualizada] = await getOrdensPagamento();
    expect(atualizada.valor).toBe(999);
    expect(atualizada.imagemUri).toBe('');
  });

  test('exclusão remove apenas a ordem alvo', async () => {
    const a = await criarOrdem();
    const b = await criarOrdem();
    await deleteOrdemPagamento(a.id);

    const restantes = await getOrdensPagamento();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].id).toBe(b.id);
  });

  test('suporta volume alto de inclusões com leitura consistente', async () => {
    const quantidade = 300;
    for (let i = 0; i < quantidade; i += 1) {
      await criarOrdem({ assunto: `Assunto ${i}` });
    }

    const lista = await getOrdensPagamento();
    expect(lista).toHaveLength(quantidade);
    expect(new Set(lista.map((o) => o.numero)).size).toBe(quantidade);
    expect(lista[quantidade - 1].numero).toBe(`OP-${String(quantidade).padStart(3, '0')}`);
  });
});
