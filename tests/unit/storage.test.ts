import {
  addCategoria,
  addDespesa,
  addPrestacao,
  abrirPrestacao,
  deleteCategoria,
  deleteDespesa,
  deletePrestacao,
  fecharPrestacao,
  getCategorias,
  getDespesas,
  getDespesasPorPrestacao,
  getPrestacoes,
  updateDespesa,
  updatePrestacao,
} from '../../storage/storage';
import { arquivos, semearArquivo } from '../mocks/memoria';
import { resetAmbiente } from '../helpers/fixtures';

describe('storage — prestações', () => {
  beforeEach(() => resetAmbiente());

  test('cria e lista prestações com status aberta', async () => {
    const nova = await addPrestacao({ descricao: 'Viagem', valorRecebido: 1000 });

    expect(nova.id).toBeTruthy();
    expect(nova.status).toBe('aberta');

    const lista = await getPrestacoes();
    expect(lista).toHaveLength(1);
    expect(lista[0].descricao).toBe('Viagem');
  });

  test('atualiza descricao e valor sem perder o registro', async () => {
    const nova = await addPrestacao({ descricao: 'Original', valorRecebido: 100 });
    await updatePrestacao(nova.id, { descricao: 'Editada', valorRecebido: 250 });

    const lista = await getPrestacoes();
    expect(lista).toHaveLength(1);
    expect(lista[0].descricao).toBe('Editada');
    expect(lista[0].valorRecebido).toBe(250);
  });

  test('fechar prestação calcula saldo de caixa', async () => {
    const nova = await addPrestacao({ descricao: 'Caixa', valorRecebido: 1000 });
    await addDespesa({
      prestacaoId: nova.id,
      descricao: 'Gasolina',
      categoriaId: 'cat-1',
      valor: 300,
      cupomUri: '',
    });

    const despesas = await getDespesasPorPrestacao(nova.id);
    const saldo = 1000 - despesas.reduce((acc, d) => acc + d.valor, 0);
    await fecharPrestacao(nova.id, saldo);

    const [atualizada] = await getPrestacoes();
    expect(atualizada.status).toBe('fechada');
    expect(atualizada.saldoTipo).toBe('caixa');
    expect(atualizada.saldoValor).toBe(700);
    expect(atualizada.dataFechamento).toBeTruthy();
  });

  test('fechar prestação com gasto maior marca reembolso', async () => {
    const nova = await addPrestacao({ descricao: 'Reembolso', valorRecebido: 100 });
    await fecharPrestacao(nova.id, -40);

    const [atualizada] = await getPrestacoes();
    expect(atualizada.saldoTipo).toBe('reembolso');
    expect(atualizada.saldoValor).toBe(40);
  });

  test('reabrir limpa os dados de fechamento', async () => {
    const nova = await addPrestacao({ descricao: 'Reabrir', valorRecebido: 100 });
    await fecharPrestacao(nova.id, 10);
    await abrirPrestacao(nova.id);

    const [atualizada] = await getPrestacoes();
    expect(atualizada.status).toBe('aberta');
    expect(atualizada.saldoTipo).toBeUndefined();
    expect(atualizada.saldoValor).toBeUndefined();
    expect(atualizada.dataFechamento).toBeUndefined();
  });

  test('excluir prestação remove também as despesas e os cupons', async () => {
    const nova = await addPrestacao({ descricao: 'Excluir', valorRecebido: 100 });
    const cupom = 'file:///app/cache/para-excluir.jpg';
    semearArquivo(cupom, 'QUJD');
    await addDespesa({
      prestacaoId: nova.id,
      descricao: 'Item',
      categoriaId: 'cat-1',
      valor: 10,
      cupomUri: cupom,
    });

    await deletePrestacao(nova.id);

    expect(await getPrestacoes()).toHaveLength(0);
    expect(await getDespesas()).toHaveLength(0);
    expect(arquivos.has(cupom)).toBe(false);
  });
});

describe('storage — despesas', () => {
  beforeEach(() => resetAmbiente());

  test('lista apenas as despesas da prestação, ordenadas por data', async () => {
    const prestacao = await addPrestacao({ descricao: 'A', valorRecebido: 10 });
    const outra = await addPrestacao({ descricao: 'B', valorRecebido: 10 });

    await addDespesa({
      prestacaoId: prestacao.id,
      descricao: 'Depois',
      categoriaId: 'c',
      valor: 5,
      cupomUri: '',
      data: '2026-02-01T00:00:00.000Z',
    });
    await addDespesa({
      prestacaoId: prestacao.id,
      descricao: 'Antes',
      categoriaId: 'c',
      valor: 5,
      cupomUri: '',
      data: '2026-01-01T00:00:00.000Z',
    });
    await addDespesa({
      prestacaoId: outra.id,
      descricao: 'De outra',
      categoriaId: 'c',
      valor: 5,
      cupomUri: '',
    });

    const lista = await getDespesasPorPrestacao(prestacao.id);
    expect(lista.map((d) => d.descricao)).toEqual(['Antes', 'Depois']);
  });

  test('atualizar cupom apaga o arquivo antigo', async () => {
    const prestacao = await addPrestacao({ descricao: 'A', valorRecebido: 10 });
    const antigo = 'file:///app/cache/antigo.jpg';
    const novo = 'file:///app/cache/novo.jpg';
    semearArquivo(antigo, 'AAA');
    semearArquivo(novo, 'BBB');

    const despesa = await addDespesa({
      prestacaoId: prestacao.id,
      descricao: 'X',
      categoriaId: 'c',
      valor: 1,
      cupomUri: antigo,
    });
    await updateDespesa(despesa.id, { cupomUri: novo });

    expect(arquivos.has(antigo)).toBe(false);
    expect(arquivos.has(novo)).toBe(true);
    const [atualizada] = await getDespesas();
    expect(atualizada.cupomUri).toBe(novo);
  });

  test('excluir despesa apaga o cupom', async () => {
    const prestacao = await addPrestacao({ descricao: 'A', valorRecebido: 10 });
    const cupom = 'file:///app/cache/descartar.jpg';
    semearArquivo(cupom, 'AAA');

    const despesa = await addDespesa({
      prestacaoId: prestacao.id,
      descricao: 'X',
      categoriaId: 'c',
      valor: 1,
      cupomUri: cupom,
    });
    await deleteDespesa(despesa.id);

    expect(await getDespesas()).toHaveLength(0);
    expect(arquivos.has(cupom)).toBe(false);
  });
});

describe('storage — categorias', () => {
  beforeEach(() => resetAmbiente());

  test('adiciona, lista e remove categorias', async () => {
    const cat = await addCategoria('Transporte');
    expect(await getCategorias()).toHaveLength(1);

    await addCategoria('Alimentação');
    expect(await getCategorias()).toHaveLength(2);

    await deleteCategoria(cat.id);
    const restantes = await getCategorias();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].nome).toBe('Alimentação');
  });
});
