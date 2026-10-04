import { carregarCupons } from '../../services/pdfCupons';
import { runtimePadrao } from '../../services/pdfRuntime';
import { arquivos, controle, semearArquivo } from '../mocks/memoria';
import {
  TAMANHO_CUPOM_GRANDE,
  TAMANHO_CUPOM_PEQUENO,
  criarDespesas,
  resetAmbiente,
  uriCupom,
} from '../helpers/fixtures';
import { instrumentarRuntime } from '../helpers/runtime';

describe('pdfCupons — carregamento', () => {
  beforeEach(() => resetAmbiente());

  test('converte cupons para data URI preservando a ordem', async () => {
    const despesas = criarDespesas(5);
    const cupons = await carregarCupons(despesas, runtimePadrao);

    expect(cupons).toHaveLength(5);
    expect(cupons.map((c) => c.numero)).toEqual([1, 2, 3, 4, 5]);
    expect(cupons[0].imagemBase64.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(cupons[0].descricao).toBe('Despesa 1');
  });

  test('não ultrapassa o limite de concorrência configurado', async () => {
    const { runtime, metricas } = instrumentarRuntime();
    const despesas = criarDespesas(30);

    await carregarCupons(despesas, runtime, { concorrencia: 3 });

    expect(metricas.maximoEmAndamento).toBeLessThanOrEqual(3);
    expect(metricas.maximoEmAndamento).toBeGreaterThan(1);
  });

  test('redimensiona cupons grandes antes de embutir no HTML', async () => {
    const despesas = criarDespesas(4);
    const cupons = await carregarCupons(despesas, runtimePadrao);

    expect(controle.chamadasRedimensionamento).toBe(4);
    for (const cupom of cupons) {
      expect(cupom.imagemBase64.length).toBeLessThan(TAMANHO_CUPOM_GRANDE);
    }
  });

  test('não redimensiona cupom que já está pequeno (geração mais rápida)', async () => {
    const despesa = criarDespesas(1)[0];
    semearArquivo(despesa.cupomUri, 'B'.repeat(TAMANHO_CUPOM_PEQUENO));

    await carregarCupons([despesa], runtimePadrao);

    expect(controle.chamadasRedimensionamento).toBe(0);
  });

  test('ignora cupom com arquivo inexistente sem derrubar o relatório', async () => {
    const despesas = criarDespesas(3);
    const cupons = await carregarCupons(despesas, runtimePadrao);
    expect(cupons).toHaveLength(3);

    const semArquivo = { ...despesas[1], cupomUri: 'file:///app/cache/nao-existe.jpg' };
    const parcial = await carregarCupons([despesas[0], semArquivo, despesas[2]], runtimePadrao);
    expect(parcial.map((c) => c.numero)).toEqual([1, 3]);
  });

  test('ignora despesa sem cupom anexado', async () => {
    const despesas = criarDespesas(2).map((d, i) => (i === 0 ? { ...d, cupomUri: '' } : d));
    const cupons = await carregarCupons(despesas, runtimePadrao);
    expect(cupons).toHaveLength(1);
    expect(cupons[0].numero).toBe(2);
  });

  test('se o redimensionamento falhar, usa a imagem original', async () => {
    controle.falharRedimensionamento = true;
    const despesas = criarDespesas(2);

    const cupons = await carregarCupons(despesas, runtimePadrao);

    expect(cupons).toHaveLength(2);
    expect(cupons[0].imagemBase64.length).toBeGreaterThan(TAMANHO_CUPOM_PEQUENO);
  });

  test('lista vazia resolve sem tocar no disco', async () => {
    const { runtime, metricas } = instrumentarRuntime();
    await expect(carregarCupons([], runtime)).resolves.toEqual([]);
    expect(metricas.chamadas).toBe(0);
    expect(arquivos.size).toBeGreaterThanOrEqual(0);
  });
});
