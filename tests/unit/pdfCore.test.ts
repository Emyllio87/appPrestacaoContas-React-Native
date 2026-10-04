import {
  agruparPorLimite,
  bytesParaBase64,
  escapeHtml,
  mapComLimite,
  montarHtmlContinuacaoCupons,
  montarHtmlOrdem,
  montarHtmlPrestacao,
  paginar,
  PdfGenerationError,
  validarPdfBase64,
} from '../../services/pdfCore';
import { criarCategoria, criarDespesas, criarOrdem, criarPrestacao, htmlBalanceado } from '../helpers/fixtures';

describe('pdfCore — escapeHtml', () => {
  test('escapa caracteres que quebram a marcação', () => {
    expect(escapeHtml('Compra <script>alert(1)</script>')).toBe(
      'Compra &lt;script&gt;alert(1)&lt;/script&gt;'
    );
    expect(escapeHtml('a & b "c" \'d\'')).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
  });

  test('trata nulo, undefined e números', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(1234.5)).toBe('1234.5');
  });

  test('não altera texto comum', () => {
    expect(escapeHtml('Material de escritório')).toBe('Material de escritório');
  });
});

describe('pdfCore — validarPdfBase64', () => {
  const pdfValido = `JVBERi0xLjQKJcTl${'A'.repeat(600)}`;

  test('aceita um PDF real', () => {
    expect(validarPdfBase64(pdfValido)).toBe(true);
  });

  test('rejeita vazio, nulo, indefinido e curto', () => {
    expect(validarPdfBase64('')).toBe(false);
    expect(validarPdfBase64(null)).toBe(false);
    expect(validarPdfBase64(undefined)).toBe(false);
    expect(validarPdfBase64('JVBERi0')).toBe(false);
    expect(validarPdfBase64('abc'.repeat(500))).toBe(false);
  });

  test('ignora espaço/BOLE no início', () => {
    expect(validarPdfBase64(`\n  ${pdfValido}`)).toBe(true);
  });
});

describe('pdfCore — bytesParaBase64', () => {
  test('equivale ao base64 nativo para qualquer comprimento', () => {
    for (const tamanho of [0, 1, 2, 3, 4, 5, 63, 64, 65, 1000, 4097]) {
      const bytes = Uint8Array.from({ length: tamanho }, (_, i) => (i * 37) % 256);
      expect(bytesParaBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  test('processa entradas grandes sem perda', () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => (i * 91) % 256);
    expect(bytesParaBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});

describe('pdfCore — paginar e agruparPorLimite', () => {
  test('paginar divide em blocos completos', () => {
    expect(paginar([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginar([], 3)).toEqual([]);
    expect(paginar([1, 2], 0)).toEqual([[1], [2]]);
  });

  test('agrupa respeitando limite de quantidade', () => {
    const grupos = agruparPorLimite([1, 2, 3, 4, 5], {
      maxItens: 2,
      maxBytes: 1_000_000,
      tamanhoDe: () => 10,
    });
    expect(grupos).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('agrupa respeitando limite de bytes', () => {
    const grupos = agruparPorLimite([1, 2, 3, 4], {
      maxItens: 100,
      maxBytes: 25,
      tamanhoDe: () => 10,
    });
    expect(grupos).toEqual([[1, 2], [3, 4]]);
  });

  test('item maior que o limite de bytes ainda cabe sozinho', () => {
    const grupos = agruparPorLimite([1, 2], {
      maxItens: 10,
      maxBytes: 5,
      tamanhoDe: () => 1000,
    });
    expect(grupos).toEqual([[1], [2]]);
  });

  test('lista vazia não gera grupos', () => {
    expect(
      agruparPorLimite([], { maxItens: 10, maxBytes: 10, tamanhoDe: () => 1 })
    ).toEqual([]);
  });
});

describe('pdfCore — mapComLimite', () => {
  test('preserva a ordem dos resultados', async () => {
    const entrada = [5, 4, 3, 2, 1];
    const saida = await mapComLimite(entrada, 2, async (item) => {
      await new Promise((r) => setTimeout(r, item));
      return item * 10;
    });
    expect(saida).toEqual([50, 40, 30, 20, 10]);
  });

  test('nunca ultrapassa o limite de concorrência', async () => {
    let emAndamento = 0;
    let maximo = 0;
    const itens = Array.from({ length: 40 }, (_, i) => i);

    await mapComLimite(itens, 3, async () => {
      emAndamento += 1;
      maximo = Math.max(maximo, emAndamento);
      await new Promise((r) => setTimeout(r, 1));
      emAndamento -= 1;
    });

    expect(maximo).toBeLessThanOrEqual(3);
    expect(maximo).toBeGreaterThan(1);
  });

  test('lista vazia resolve sem chamar a função', async () => {
    const fn = jest.fn();
    await expect(mapComLimite([], 4, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  test('propaga erro da função', async () => {
    await expect(
      mapComLimite([1], 1, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
  });

  test('limite menor que a lista ainda cobre todos os itens', async () => {
    const itens = Array.from({ length: 17 }, (_, i) => i);
    const saida = await mapComLimite(itens, 1, async (i) => i);
    expect(saida).toEqual(itens);
  });
});

describe('pdfCore — HTML da prestação', () => {
  const prestacao = criarPrestacao({
    descricao: 'Relatório <anual> & "final"',
    valorRecebido: 1200,
    dataFechamento: '2026-03-01T12:00:00.000Z',
  });
  const despesas = criarDespesas(3);
  const categorias = [criarCategoria(1, 'Alimentação & <extra>')];

  test('gera documento balanceado com todos os registros', () => {
    const html = montarHtmlPrestacao({
      prestacao,
      despesas,
      categorias,
      cupons: [],
      parte: 1,
      totalPartes: 1,
      geradoEm: '2026-03-02T10:00:00.000Z',
    });

    expect(htmlBalanceado(html)).toBe(true);
    for (const despesa of despesas) {
      expect(html).toContain(`>${despesa.descricao}<`);
    }
    expect(html).toContain('Relatório &lt;anual&gt; &amp; &quot;final&quot;');
    expect(html).toContain('Alimentação &amp; &lt;extra&gt;');
    expect(html).toContain('Despesas');
    expect(html).toContain('Resumo Financeiro');
  });

  test('não interpola HTML cru vindo do usuário', () => {
    const perigosa = criarDespesas(1)[0];
    const comDescricao = [{ ...perigosa, descricao: '</td><script>x</script>' }];
    const html = montarHtmlPrestacao({
      prestacao,
      despesas: comDescricao,
      categorias,
      cupons: [],
      parte: 1,
      totalPartes: 1,
      geradoEm: '2026-03-02T10:00:00.000Z',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;/td&gt;');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('grade de cupons usa tabela (pagination confiável) e não flex', () => {
    const cupons = despesas.map((d, i) => ({
      numero: i + 1,
      descricao: d.descricao,
      data: '01/01/2026',
      valor: d.valor,
      imagemBase64: 'data:image/jpeg;base64,QUJD',
    }));

    const html = montarHtmlPrestacao({
      prestacao,
      despesas,
      categorias,
      cupons,
      parte: 1,
      totalPartes: 1,
      geradoEm: '2026-03-02T10:00:00.000Z',
    });

    expect(html).toContain('<table class="cupons">');
    expect(html).not.toContain('display: flex');
    expect(html).not.toContain('cupons-grid');
    expect(html).toContain('page-break-inside: avoid');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('a tabela tem cabeçalho fixo para repetir entre páginas', () => {
    const html = montarHtmlPrestacao({
      prestacao,
      despesas,
      categorias,
      cupons: [],
      parte: 1,
      totalPartes: 1,
      geradoEm: '2026-03-02T10:00:00.000Z',
    });
    expect(html).toContain('<thead>');
    expect(html).toContain('display: table-header-group');
  });

  test('continuação indica a parte correta', () => {
    const html = montarHtmlContinuacaoCupons({
      prestacao,
      cupons: [
        { numero: 9, descricao: 'X', data: '01/01/2026', valor: 1, imagemBase64: 'data:image/jpeg;base64,QUJD' },
      ],
      parte: 2,
      totalPartes: 3,
      geradoEm: '2026-03-02T10:00:00.000Z',
    });
    expect(html).toContain('parte 2 de 3');
    expect(htmlBalanceado(html)).toBe(true);
  });

  test('erro de domínio tem nome reconhecível', () => {
    const erro = new PdfGenerationError('falhou');
    expect(erro).toBeInstanceOf(Error);
    expect(erro.name).toBe('PdfGenerationError');
  });
});

describe('pdfCore — HTML da ordem de pagamento', () => {
  test('gera PDF da ordem sem imagem anexada', () => {
    const html = montarHtmlOrdem(criarOrdem({ imagemUri: '' }), null);
    expect(htmlBalanceado(html)).toBe(true);
    expect(html).toContain('OP-001');
    expect(html).not.toContain('Imagem do Pedido');
    expect(html).not.toContain('<img');
  });

  test('gera PDF da ordem com imagem anexada', () => {
    const html = montarHtmlOrdem(criarOrdem(), 'data:image/jpeg;base64,QUJD');
    expect(htmlBalanceado(html)).toBe(true);
    expect(html).toContain('Imagem do Pedido');
    expect(html).toContain('data:image/jpeg;base64,QUJD');
  });

  test('escapa os campos livres da ordem', () => {
    const html = montarHtmlOrdem(
      criarOrdem({ fornecedor: 'A & B <Ltda>', assunto: 'Compra "urgente"' }),
      null
    );
    expect(html).toContain('A &amp; B &lt;Ltda&gt;');
    expect(html).toContain('Compra &quot;urgente&quot;');
    expect(htmlBalanceado(html)).toBe(true);
  });
});
