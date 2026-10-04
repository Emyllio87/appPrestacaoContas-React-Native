import { PDFDocument } from 'pdf-lib';
import { PdfGenerationError } from '../../services/pdfCore';
import { runtimePadrao } from '../../services/pdfRuntime';
import { fundirPdfs, gerarArquivoPdf, gravarPdf, renderizarPdf } from '../../services/pdfWriter';
import { arquivos } from '../mocks/memoria';
import { estado, prepararFalhas, resetPrint } from '../mocks/expo-print';

async function criarPdfBase64(paginas: number): Promise<string> {
  const documento = await PDFDocument.create();
  for (let i = 0; i < paginas; i += 1) documento.addPage([595, 842]);
  const bytes = await documento.save();
  return Buffer.from(bytes).toString('base64');
}

describe('pdfWriter — renderizarPdf', () => {
  beforeEach(() => resetPrint());

  test('renderiza um PDF válido na primeira tentativa', async () => {
    const base64 = await renderizarPdf('<html><body>ok</body></html>', runtimePadrao, {
      intervaloMs: 0,
    });
    expect(base64.startsWith('JVBERi')).toBe(true);
    expect(estado.chamadas).toHaveLength(1);
  });

  test('repente quando a nativa devolve PDF vazio e grava o arquivo correto', async () => {
    prepararFalhas(1, 'vazio');
    const base64 = await renderizarPdf('<html><body>ok</body></html>', runtimePadrao, {
      tentativas: 3,
      intervaloMs: 0,
    });
    expect(base64.startsWith('JVBERi')).toBe(true);
    expect(estado.chamadas).toHaveLength(2);
  });

  test('repente quando a nativa lança exceção', async () => {
    prepararFalhas(2, 'erro');
    const base64 = await renderizarPdf('<html><body>ok</body></html>', runtimePadrao, {
      tentativas: 3,
      intervaloMs: 0,
    });
    expect(estado.chamadas).toHaveLength(3);
    expect(base64.startsWith('JVBERi')).toBe(true);
  });

  test('lança erro claro quando todas as tentativas falham', async () => {
    prepararFalhas(10, 'vazio');
    await expect(
      renderizarPdf('<html></html>', runtimePadrao, { tentativas: 3, intervaloMs: 0 })
    ).rejects.toBeInstanceOf(PdfGenerationError);
    expect(estado.chamadas).toHaveLength(3);
  });

  test('não tenta mais que o limite de tentativas com falha de exceção', async () => {
    prepararFalhas(10, 'erro');
    await expect(
      renderizarPdf('<html></html>', runtimePadrao, { tentativas: 2, intervaloMs: 0 })
    ).rejects.toThrow();
    expect(estado.chamadas).toHaveLength(2);
  });
});

describe('pdfWriter — fundirPdfs', () => {
  test('com uma única parte devolve o próprio conteúdo', async () => {
    const unico = await criarPdfBase64(2);
    await expect(fundirPdfs([unico])).resolves.toBe(unico);
  });

  test('une várias partes preservando todas as páginas', async () => {
    const partes = [await criarPdfBase64(1), await criarPdfBase64(3), await criarPdfBase64(2)];
    const fundido = await fundirPdfs(partes);

    expect(fundido.startsWith('JVBERi')).toBe(true);
    const documento = await PDFDocument.load(fundido);
    expect(documento.getPageCount()).toBe(6);
  });

  test('rejeita lista vazia', async () => {
    await expect(fundirPdfs([])).rejects.toBeInstanceOf(PdfGenerationError);
  });

  test('rejeita parte inválida com erro claro', async () => {
    await expect(fundirPdfs(['conteudo-invalido', await criarPdfBase64(1)])).rejects.toBeInstanceOf(
      PdfGenerationError
    );
  });
});

describe('pdfWriter — gravarPdf', () => {
  beforeEach(() => resetPrint());

  test('grava apenas conteúdo validado', async () => {
    const base64 = await criarPdfBase64(1);
    const destino = `${runtimePadrao.documentDirectory}relatorio.pdf`;

    await expect(gravarPdf(base64, destino, runtimePadrao)).resolves.toBe(destino);
    expect(arquivos.get(destino)?.base64).toBe(base64);
  });

  test('recusa gravar PDF vazio (não deixa arquivo em branco)', async () => {
    const destino = `${runtimePadrao.documentDirectory}vazio.pdf`;
    await expect(gravarPdf('', destino, runtimePadrao)).rejects.toBeInstanceOf(PdfGenerationError);
    expect(arquivos.has(destino)).toBe(false);
  });

  test('recusa gravar conteúdo que não é PDF', async () => {
    const destino = `${runtimePadrao.documentDirectory}lixo.pdf`;
    await expect(
      gravarPdf('YWJjZGVm'.repeat(500), destino, runtimePadrao)
    ).rejects.toBeInstanceOf(PdfGenerationError);
    expect(arquivos.has(destino)).toBe(false);
  });
});

describe('pdfWriter — gerarArquivoPdf', () => {
  beforeEach(() => resetPrint());

  test('renderiza e grava em um só passo', async () => {
    const caminho = await gerarArquivoPdf(
      '<html><body>relatório</body></html>',
      'relatorio.pdf',
      runtimePadrao,
      { intervaloMs: 0 }
    );
    expect(caminho).toBe(`${runtimePadrao.documentDirectory}relatorio.pdf`);
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
  });

  test('falha nativa permanente não deixa arquivo gravado', async () => {
    prepararFalhas(10, 'vazio');
    await expect(
      gerarArquivoPdf('<html></html>', 'falho.pdf', runtimePadrao, {
        tentativas: 2,
        intervaloMs: 0,
      })
    ).rejects.toBeInstanceOf(PdfGenerationError);
    expect(arquivos.has(`${runtimePadrao.documentDirectory}falho.pdf`)).toBe(false);
  });
});
