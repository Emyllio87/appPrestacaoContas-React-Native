import { PDFDocument } from 'pdf-lib';
import { MAX_BYTES_PAR_PARTE, MAX_CUPONS_PAR_PARTE, gerarPdfPrestacao } from '../../services/pdfService';
import { mapComLimite } from '../../services/pdfCore';
import {
  addDespesa,
  addPrestacao,
  getDespesas,
  getDespesasPorPrestacao,
} from '../../storage/storage';
import { addOrdemPagamento, getOrdensPagamento } from '../../storage/storageOrdens';
import { gerarPdfOrdem } from '../../services/pdfOrdemService';
import { estado as estadoPrint, resetPrint } from '../mocks/expo-print';
import { arquivos } from '../mocks/memoria';
import { criarCategoria, criarDespesas, criarOrdem, criarPrestacao, resetAmbiente } from '../helpers/fixtures';

/** Orçamentos generosos de tempo para não falhar em máquinas lentas de CI. */
const TETO_HTML_MUITOS_REGISTROS = 8_000;
const TETO_PDF_COM_CUPONS = 30_000;
const TETO_STORAGE = 30_000;
const TETO_PDF_ORDEM = 5_000;

function medir(): () => number {
  const inicio = Date.now();
  return () => Date.now() - inicio;
}

describe('carga — muitos registros na prestação', () => {
  beforeEach(() => resetAmbiente());

  test('500 despesas geram HTML completo em tempo curto (1 chamada nativa)', async () => {
    const prestacao = criarPrestacao();
    const despesas = Array.from({ length: 500 }, (_, i) => ({
      id: `d-${i}`,
      prestacaoId: prestacao.id,
      descricao: `Despesa ${i + 1} de um fornecedor com nome longo`,
      categoriaId: 'cat-1',
      valor: (i + 1) * 3.37,
      data: '2026-01-15T12:00:00.000Z',
      cupomUri: '',
    }));
    const categorias = [criarCategoria(1)];

    const fim = medir();
    const caminho = await gerarPdfPrestacao(prestacao, despesas, categorias, { intervaloMs: 0 });
    const duracao = fim();

    expect(duracao).toBeLessThan(TETO_HTML_MUITOS_REGISTROS);
    expect(estadoPrint.chamadas).toHaveLength(1);
    expect(estadoPrint.chamadas[0]).toContain('<tbody>');
    // Uma linha por despesa.
    const linhas = estadoPrint.chamadas[0].split('<tr>').length - 1;
    expect(linhas).toBeGreaterThanOrEqual(501);
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
  });

  test('120 cupons são fatiados em partes pequenas e unidos em um PDF válido', async () => {
    const prestacao = criarPrestacao();
    const despesas = criarDespesas(120);
    const categorias = [criarCategoria(1)];

    const fim = medir();
    const caminho = await gerarPdfPrestacao(prestacao, despesas, categorias, { intervaloMs: 0 });
    const duracao = fim();

    expect(duracao).toBeLessThan(TETO_PDF_COM_CUPONS);

    // Fatiamento: nenhuma chamada nativa estoura o limite de payload.
    const esperadas = Math.ceil(120 / MAX_CUPONS_PAR_PARTE);
    expect(estadoPrint.chamadas).toHaveLength(esperadas);
    for (const html of estadoPrint.chamadas) {
      expect(html.length).toBeLessThanOrEqual(MAX_BYTES_PAR_PARTE + 200_000);
    }

    // O arquivo final é um PDF real com todas as páginas das partes.
    const base64 = arquivos.get(caminho)?.base64 ?? '';
    expect(base64.startsWith('JVBERi')).toBe(true);
    const documento = await PDFDocument.load(base64);
    const paginasEsperadas = estadoPrint.chamadas.reduce(
      (acc, html) => acc + Math.max(1, Math.ceil(html.length / 45_000)),
      0
    );
    expect(documento.getPageCount()).toBe(paginasEsperadas);
    expect(documento.getPageCount()).toBeGreaterThan(esperadas);
  });

  test('quantidade de cupons acima do limite por parte força mais fatias', async () => {
    const despesas = criarDespesas(75);
    await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], {
      intervaloMs: 0,
    });
    expect(estadoPrint.chamadas).toHaveLength(3);
    resetPrint();

    await gerarPdfPrestacao(criarPrestacao(), criarDespesas(30), [criarCategoria(1)], {
      intervaloMs: 0,
    });
    expect(estadoPrint.chamadas).toHaveLength(1);
  });
});

describe('carga — armazenamento', () => {
  beforeEach(() => resetAmbiente());

  test('400 despesas gravadas e relidas dentro do orçamento', async () => {
    const prestacao = await addPrestacao({ descricao: 'Carga', valorRecebido: 100000 });

    const fim = medir();
    for (let i = 0; i < 400; i += 1) {
      await addDespesa({
        prestacaoId: prestacao.id,
        descricao: `Despesa ${i}`,
        categoriaId: 'cat-1',
        valor: i + 1,
        cupomUri: '',
      });
    }
    const lidas = await getDespesasPorPrestacao(prestacao.id);
    const duracao = fim();

    expect(lidas).toHaveLength(400);
    expect(duracao).toBeLessThan(TETO_STORAGE);
    expect(await getDespesas()).toHaveLength(400);
  });

  test('300 ordens de pagamento gravadas mantêm numeração única', async () => {
    const fim = medir();
    for (let i = 0; i < 300; i += 1) {
      await addOrdemPagamento({
        fornecedor: `Fornecedor ${i}`,
        tipoChavePix: 'cpf',
        pixInfo: '12345678900',
        valor: i + 1,
        assunto: `Assunto ${i}`,
        imagemUri: '',
      });
    }
    const duracao = fim();

    const ordens = await getOrdensPagamento();
    expect(ordens).toHaveLength(300);
    expect(new Set(ordens.map((o) => o.numero)).size).toBe(300);
    expect(duracao).toBeLessThan(TETO_STORAGE);
  });
});

describe('carga — outros documentos', () => {
  beforeEach(() => resetAmbiente());

  test('PDF de ordem de pagamento responde rápido sem imagem', async () => {
    const fim = medir();
    const caminho = await gerarPdfOrdem(criarOrdem({ imagemUri: '' }), { intervaloMs: 0 });
    const duracao = fim();

    expect(duracao).toBeLessThan(TETO_PDF_ORDEM);
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    expect(estadoPrint.chamadas).toHaveLength(1);
  });

  test('concorrência limitada sustenta volume alto sem exceder o limite', async () => {
    const itens = Array.from({ length: 1000 }, (_, i) => i);
    let emAndamento = 0;
    let maximo = 0;

    const fim = medir();
    const resultado = await mapComLimite(itens, 3, async (item) => {
      emAndamento += 1;
      maximo = Math.max(maximo, emAndamento);
      await new Promise((r) => setImmediate(r));
      emAndamento -= 1;
      return item;
    });
    const duracao = fim();

    expect(resultado).toHaveLength(1000);
    expect(maximo).toBeLessThanOrEqual(3);
    expect(duracao).toBeLessThan(TETO_STORAGE);
  });
});
