import { PDFDocument } from 'pdf-lib';
import { PdfGenerationError, mapComLimite } from '../../services/pdfCore';
import { gerarPdfPrestacao } from '../../services/pdfService';
import {
  addOrdemPagamento,
  deleteOrdemPagamento,
  getOrdensPagamento,
} from '../../storage/storageOrdens';
import {
  estado as estadoPrint,
  prepararFalhaSeletiva,
  prepararFalhas,
  resetPrint,
} from '../mocks/expo-print';
import { arquivos, controle, semearArquivo } from '../mocks/memoria';
import {
  criarCategoria,
  criarDespesas,
  criarPrestacao,
  htmlBalanceado,
  resetAmbiente,
} from '../helpers/fixtures';

const TETO_PDF_EXTREMO = 30_000;

const pdfsDoArmazenamento = (): string[] =>
  [...arquivos.keys()].filter((chave) => chave.endsWith('.pdf'));

describe('estresse — falha da camada nativa', () => {
  beforeEach(() => resetAmbiente());

  test('falha permanente gera erro claro e NENHUM arquivo é gravado', async () => {
    prepararFalhas(100, 'vazio');

    await expect(
      gerarPdfPrestacao(criarPrestacao(), criarDespesas(5), [criarCategoria(1)], {
        tentativas: 3,
        intervaloMs: 0,
      })
    ).rejects.toBeInstanceOf(PdfGenerationError);

    expect(estadoPrint.chamadas).toHaveLength(3);
    expect(pdfsDoArmazenamento()).toHaveLength(0);
  });

  test('falha com exceção também não deixa arquivo parcial', async () => {
    prepararFalhas(100, 'erro');

    await expect(
      gerarPdfPrestacao(criarPrestacao(), criarDespesas(3), [criarCategoria(1)], {
        tentativas: 2,
        intervaloMs: 0,
      })
    ).rejects.toBeInstanceOf(PdfGenerationError);

    expect(pdfsDoArmazenamento()).toHaveLength(0);
  });

  test('tentativa única não repete a chamada nativa', async () => {
    prepararFalhas(1, 'vazio');

    await expect(
      gerarPdfPrestacao(criarPrestacao(), criarDespesas(3), [criarCategoria(1)], {
        tentativas: 1,
        intervaloMs: 0,
      })
    ).rejects.toBeInstanceOf(PdfGenerationError);

    expect(estadoPrint.chamadas).toHaveLength(1);
  });

  test('falha apenas na 2ª parte aborta tudo e não grava arquivo nenhum', async () => {
    // 40 cupons => 2 partes; a partir da segunda o render falha sempre.
    prepararFalhaSeletiva((html) => html.includes('parte 2 de 2'), 'vazio');

    await expect(
      gerarPdfPrestacao(criarPrestacao(), criarDespesas(40), [criarCategoria(1)], {
        tentativas: 1,
        intervaloMs: 0,
      })
    ).rejects.toBeInstanceOf(PdfGenerationError);

    // 1ª parte renderiza, a 2ª falha; a gravação final nunca acontece.
    expect(estadoPrint.chamadas).toHaveLength(2);
    expect(pdfsDoArmazenamento()).toHaveLength(0);
  });
});

describe('estresse — dados extremos', () => {
  beforeEach(() => resetAmbiente());

  test('descrições gigantes e caracteres especiais não quebram a geração', async () => {
    const prestacao = criarPrestacao({
      descricao: 'Relatório </body><script>alert(1)</script> & "grande" '.repeat(20),
    });
    const despesas = criarDespesas(3).map((d, i) => ({
      ...d,
      descricao: `Item ${i} </table> <b>negrito</b> ${'X'.repeat(50_000)}`,
    }));

    const caminho = await gerarPdfPrestacao(prestacao, despesas, [criarCategoria(1)], {
      intervaloMs: 0,
    });

    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    const html = estadoPrint.chamadas.join('');
    expect(html).not.toContain('<script>');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('valores NaN, Infinity e negativos não corrompem o total do relatório', async () => {
    const prestacao = criarPrestacao({ valorRecebido: Number.NaN });
    const despesas = criarDespesas(4).map((d, i) => ({
      ...d,
      cupomUri: '',
      valor: [Number.NaN, Number.POSITIVE_INFINITY, -50, 120.5][i] as number,
    }));

    const caminho = await gerarPdfPrestacao(prestacao, despesas, [criarCategoria(1)], {
      intervaloMs: 0,
    });

    const html = estadoPrint.chamadas[0];
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    // Soma apenas os valores finitos: -50 + 120,5 = 70,50
    expect(html).toContain('R$ 70,50');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('datas inválidas não lançam exceção', async () => {
    const despesas = criarDespesas(2).map((d) => ({ ...d, data: 'data-invalida', cupomUri: '' }));
    const caminho = await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], {
      intervaloMs: 0,
    });
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
  });

  test('2000 despesas em texto puro geram um único PDF dentro do orçamento', async () => {
    const despesas = Array.from({ length: 2000 }, (_, i) => ({
      id: `d-${i}`,
      prestacaoId: 'prest-1',
      descricao: `Despesa ${i}`,
      categoriaId: 'cat-1',
      valor: 1,
      data: '2026-01-01T00:00:00.000Z',
      cupomUri: '',
    }));

    const inicio = Date.now();
    const caminho = await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], {
      intervaloMs: 0,
    });
    const duracao = Date.now() - inicio;

    expect(duracao).toBeLessThan(TETO_PDF_EXTREMO);
    expect(estadoPrint.chamadas).toHaveLength(1);
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
  });

  test('um único cupom maior que o limite por parte ainda gera PDF válido', async () => {
    const despesas = criarDespesas(1);
    semearArquivo(despesas[0].cupomUri, 'A'.repeat(500_000));
    controle.limiteReduzido = 400_000; // continua acima do limite por parte

    const caminho = await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], {
      intervaloMs: 0,
      maxBytesPorParte: 100_000,
    });

    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    expect(estadoPrint.chamadas).toHaveLength(1);
    expect(estadoPrint.chamadas[0].length).toBeGreaterThan(100_000);
  });
});

describe('estresse — fatiamento extremo', () => {
  beforeEach(() => resetAmbiente());

  test('limite de bytes mínimo força uma parte por cupom e a fusão une tudo', async () => {
    const despesas = criarDespesas(10);

    const caminho = await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], {
      intervaloMs: 0,
      maxBytesPorParte: 1,
    });

    expect(estadoPrint.chamadas).toHaveLength(10);

    const rotulos = estadoPrint.chamadas.join('');
    for (let i = 1; i <= 10; i += 1) {
      expect(rotulos).toContain(`#${i} - Despesa ${i}`);
    }

    const base64 = arquivos.get(caminho)?.base64 ?? '';
    expect(base64.startsWith('JVBERi')).toBe(true);
    const documento = await PDFDocument.load(base64);
    const esperadas = estadoPrint.chamadas.reduce(
      (acc, html) => acc + Math.max(1, Math.ceil(html.length / 45_000)),
      0
    );
    expect(documento.getPageCount()).toBe(esperadas);
  });
});

describe('estresse — concorrência sob falhas', () => {
  test('todos os itens são processados sem exceder o limite, mesmo com retries internos', async () => {
    let emAndamento = 0;
    let maximo = 0;
    const processados = new Set<number>();

    const itens = Array.from({ length: 600 }, (_, i) => i);
    const resultado = await mapComLimite(itens, 4, async (item) => {
      emAndamento += 1;
      maximo = Math.max(maximo, emAndamento);
      try {
        await new Promise((r) => setTimeout(r, 1));
        if (item % 10 === 7) throw new Error(`falha simulada no item ${item}`);
        processados.add(item);
        return item;
      } catch {
        // Retry local, como acontece na camada de renderização.
        await new Promise((r) => setTimeout(r, 1));
        processados.add(item);
        return item;
      } finally {
        emAndamento -= 1;
      }
    });

    expect(resultado).toHaveLength(600);
    expect(processados.size).toBe(600);
    expect(maximo).toBeLessThanOrEqual(4);
    expect(emAndamento).toBe(0);
  });

  test('erro não tratado propaga e nenhum trabalho fica pendurado', async () => {
    let emAndamento = 0;
    const itens = Array.from({ length: 50 }, (_, i) => i);

    await expect(
      mapComLimite(itens, 5, async (item) => {
        emAndamento += 1;
        await new Promise((r) => setTimeout(r, 1));
        emAndamento -= 1;
        if (item === 10) throw new Error('falha crítica');
        return item;
      })
    ).rejects.toThrow('falha crítica');

    await new Promise((r) => setTimeout(r, 20));
    expect(emAndamento).toBe(0);
  });
});

describe('estresse — armazenamento', () => {
  beforeEach(() => resetAmbiente());

  test('500 inclusões com exclusões intercaladas mantêm numeração íntegra', async () => {
    const criadas: string[] = [];

    for (let i = 0; i < 500; i += 1) {
      const ordem = await addOrdemPagamento({
        fornecedor: `Fornecedor ${i}`,
        tipoChavePix: 'cpf',
        pixInfo: '12345678900',
        valor: i,
        assunto: `Assunto ${i}`,
        imagemUri: i % 2 === 0 ? `file:///app/cache/${i}.jpg` : '',
      });
      criadas.push(ordem.id);
      if (i % 7 === 6) {
        await deleteOrdemPagamento(criadas[criadas.length - 1]);
        criadas.pop();
      }
    }

    const finais = await getOrdensPagamento();
    expect(finais).toHaveLength(criadas.length);
    expect(new Set(finais.map((o) => o.numero)).size).toBe(finais.length);
    expect(new Set(finais.map((o) => o.id)).size).toBe(finais.length);

    // Ordem sem imagem convive com ordens com imagem.
    expect(finais.some((o) => !o.imagemUri)).toBe(true);
    expect(finais.some((o) => !!o.imagemUri)).toBe(true);
  });

  test('resetPrint zebra os contadores entre execuções', () => {
    resetPrint();
    expect(estadoPrint.chamadas).toHaveLength(0);
    expect(estadoPrint.falhasRestantes).toBe(0);
    expect(estadoPrint.filtroFalha).toBeNull();
  });
});
