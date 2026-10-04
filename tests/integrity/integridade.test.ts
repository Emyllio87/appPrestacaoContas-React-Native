import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { somarValores } from '../../services/pdfCore';
import { gerarPdfPrestacao } from '../../services/pdfService';
import { gerarPdfOrdem } from '../../services/pdfOrdemService';
import { addOrdemPagamento, deleteOrdemPagamento, getOrdensPagamento } from '../../storage/storageOrdens';
import { estado as estadoPrint, resetPrint } from '../mocks/expo-print';
import { arquivos, semearArquivo } from '../mocks/memoria';
import { formatarMoeda } from '../../utils/formatacao';
import {
  criarCategoria,
  criarDespesas,
  criarOrdem,
  criarPrestacao,
  htmlBalanceado,
  resetAmbiente,
  uriCupom,
} from '../helpers/fixtures';

const raiz = join(__dirname, '..', '..');

function extrairTotalGasto(html: string): string | null {
  const correspondencia = /Total gasto<\/td>\s*<td>([^<]+)<\/td>/.exec(html);
  return correspondencia ? correspondencia[1] : null;
}

describe('integridade — totais financeiros do relatório', () => {
  beforeEach(() => resetAmbiente());

  test('o total impresso confere exatamente com a soma das despesas', async () => {
    const despesas = criarDespesas(6).map((d, i) => ({ ...d, valor: 10.5 + i * 3.25, cupomUri: '' }));
    const somaEsperada = somarValores(despesas.map((d) => d.valor));

    await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], { intervaloMs: 0 });

    const html = estadoPrint.chamadas[0];
    expect(extrairTotalGasto(html)).toBe(formatarMoeda(somaEsperada));
    expect(formatarMoeda(somaEsperada)).toBe('R$ 111,75');
  });

  test('valor recebido e saldo aparecem coerentes', async () => {
    const prestacao = criarPrestacao({
      valorRecebido: 1000,
      status: 'fechada',
      saldoTipo: 'reembolso',
      saldoValor: 123.45,
      dataFechamento: '2026-03-01T12:00:00.000Z',
    });
    const despesas = criarDespesas(2).map((d) => ({ ...d, valor: 500, cupomUri: '' }));

    await gerarPdfPrestacao(prestacao, despesas, [criarCategoria(1)], { intervaloMs: 0 });
    const html = estadoPrint.chamadas[0];

    expect(html).toContain('R$ 1.000,00');
    expect(html).toContain('Valor a Reembolsar');
    expect(html).toContain('R$ 123,45');
    expect(html).toContain('Fechada em');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('todas as despesas têm linha na tabela (nada some com o fatiamento)', async () => {
    const despesas = criarDespesas(90);

    await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], { intervaloMs: 0 });

    const html = estadoPrint.chamadas[0];
    for (const despesa of despesas.slice(0, 30)) {
      expect(html).toContain(`>${despesa.descricao}<`);
    }
    // As partes seguintes continuam a numeração dos cupons.
    expect(estadoPrint.chamadas.length).toBeGreaterThan(1);
    expect(estadoPrint.chamadas[1]).toContain('parte 2 de');
    expect(estadoPrint.chamadas[1]).toContain(`#31 - Despesa 31`);
  });

  test('cupom apagado não remove a linha da despesa no relatório', async () => {
    const despesas = criarDespesas(6);
    // Metade dos arquivos de cupom "some" do aparelho.
    for (const indice of [2, 4, 6]) {
      arquivos.delete(uriCupom(indice));
    }

    await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], { intervaloMs: 0 });

    const html = estadoPrint.chamadas[0];
    const linhas = html.split('<tr>').length - 1;
    expect(linhas).toBeGreaterThanOrEqual(7); // cabeçalho + 6 despesas
    for (const despesa of despesas) {
      expect(html).toContain(`>${despesa.descricao}<`);
    }
    expect(arquivos.get(uriCupom(1))).toBeTruthy();
    expect(arquivos.has(uriCupom(4))).toBe(false);
  });

  test('categoria desconhecida vira "Sem categoria" em vez de quebrar', async () => {
    const despesas = [{ ...criarDespesas(1)[0], categoriaId: 'inexistente', cupomUri: '' }];
    await gerarPdfPrestacao(criarPrestacao(), despesas, [], { intervaloMs: 0 });
    expect(estadoPrint.chamadas[0]).toContain('Sem categoria');
  });
});

describe('integridade — arquivo gerado', () => {
  beforeEach(() => resetAmbiente());

  test('o bytes gravado em disco é exatamente o PDF validado', async () => {
    const caminho = await gerarPdfPrestacao(
      criarPrestacao(),
      criarDespesas(4),
      [criarCategoria(1)],
      { intervaloMs: 0 }
    );

    const gravado = arquivos.get(caminho)?.base64 ?? '';
    expect(gravado.startsWith('JVBERi')).toBe(true);
    expect(Buffer.from(gravado, 'base64').subarray(0, 5).toString()).toBe('%PDF-');

    // Regravação idempotente: gerar de novo produz o mesmo arquivo válido.
    resetPrint();
    const segundo = await gerarPdfPrestacao(
      criarPrestacao(),
      criarDespesas(4),
      [criarCategoria(1)],
      { intervaloMs: 0 }
    );
    expect(segundo).toBe(caminho);
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
  });

  test('fusão de partes preserva a soma das páginas', async () => {
    const caminho = await gerarPdfPrestacao(
      criarPrestacao(),
      criarDespesas(60),
      [criarCategoria(1)],
      { intervaloMs: 0 }
    );

    const documento = await PDFDocument.load(arquivos.get(caminho)?.base64 ?? '');
    const esperadas = estadoPrint.chamadas.reduce(
      (acc, html) => acc + Math.max(1, Math.ceil(html.length / 45_000)),
      0
    );
    expect(documento.getPageCount()).toBe(esperadas);
    expect(estadoPrint.chamadas).toHaveLength(2);
  });

  test('escapamento impede injeção de marcação no relatório', async () => {
    const despesas = [
      { ...criarDespesas(1)[0], descricao: '</tbody></table><img src=x onerror=alert(1)>', cupomUri: '' },
    ];

    await gerarPdfPrestacao(criarPrestacao(), despesas, [criarCategoria(1)], { intervaloMs: 0 });

    const html = estadoPrint.chamadas[0];
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(htmlBalanceado(html)).toBe(true);
  });
});

describe('integridade — ordem de pagamento sem imagem', () => {
  beforeEach(() => resetAmbiente());

  test('PDF da ordem sem anexo não tem seção de imagem', async () => {
    const caminho = await gerarPdfOrdem(criarOrdem({ imagemUri: '' }), { intervaloMs: 0 });

    const html = estadoPrint.chamadas[0];
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    expect(html).not.toContain('Imagem do Pedido');
    expect(html).not.toContain('<img');
    expect(html).toContain('Fornecedor Ltda');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('PDF da ordem com anexo mantém a imagem', async () => {
    semearArquivo('file:///app/cache/pedido.jpg', 'QUJDQUJD');
    const caminho = await gerarPdfOrdem(
      criarOrdem({ imagemUri: 'file:///app/cache/pedido.jpg' }),
      { intervaloMs: 0 }
    );

    const html = estadoPrint.chamadas[0];
    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    expect(html).toContain('Imagem do Pedido');
    expect(html).toContain('data:image/jpeg;base64,QUJDQUJD');
  });

  test('anexo que sumiu do aparelho não impede a geração', async () => {
    const caminho = await gerarPdfOrdem(
      criarOrdem({ imagemUri: 'file:///app/cache/sumiu.jpg' }),
      { intervaloMs: 0 }
    );

    expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
    expect(estadoPrint.chamadas[0]).not.toContain('Imagem do Pedido');
  });

  test('numeração das ordens permanece única mesmo com inclusões e exclusões', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      const ordem = await addOrdemPagamento({
        fornecedor: `F${i}`,
        tipoChavePix: 'cpf',
        pixInfo: '123',
        valor: 10,
        assunto: `A${i}`,
        imagemUri: i % 3 === 0 ? '' : `file:///app/cache/${i}.jpg`,
      });
      ids.push(ordem.id);
      if (i % 5 === 4) {
        await deleteOrdemPagamento(ids[ids.length - 1]);
        ids.pop();
      }
    }

    const ordens = await getOrdensPagamento();
    expect(ordens).toHaveLength(ids.length);
    expect(new Set(ordens.map((o) => o.numero)).size).toBe(ordens.length);
  });
});

describe('integridade — regras das telas', () => {
  test('tela de nova ordem não bloqueia mais o salvamento sem imagem', () => {
    const fonte = readFileSync(join(raiz, 'app/ordens-pagamento/nova-ordem.tsx'), 'utf8');
    expect(fonte).not.toContain('if (!imagemUri)');
    expect(fonte).not.toContain("setErroImagem('Anexe a imagem do pedido')");
    expect(fonte).toContain('imagemUri: imagemUri ??');
    expect(fonte).toContain('opcional');
  });

  test('tela de edição não bloqueia mais o salvamento sem imagem', () => {
    const fonte = readFileSync(join(raiz, 'app/ordens-pagamento/[id]/editar-ordem.tsx'), 'utf8');
    expect(fonte).not.toContain('if (!imagemUri)');
    expect(fonte).not.toContain("setErroImagem('Anexe a imagem do pedido')");
    expect(fonte).toContain('imagemUri: imagemUri ??');
  });

  test('tipo da ordem de pagamento aceita imagem opcional', () => {
    const fonte = readFileSync(join(raiz, 'types/index.ts'), 'utf8');
    expect(fonte).toMatch(/imagemUri\?:\s*string/);
  });

  test('nenhum serviço grava PDF com base64 silenciosamente vazio', () => {
    const arquivosDeServico = [
      'services/pdfService.ts',
      'services/pdfOrdemService.ts',
      'services/pdfDiariaService.ts',
      'app/ordens-pagamento/solicitacao.tsx',
      'app/pedidos/cotacao.tsx',
      'app/pedidos/historico.tsx',
    ];
    for (const caminho of arquivosDeServico) {
      const fonte = readFileSync(join(raiz, caminho), 'utf8');
      expect(fonte).not.toContain("resultado.base64 ?? ''");
    }
  });
});
