import * as FileSystem from 'expo-file-system/legacy';
import { gerarPdfPrestacao } from '../../services/pdfService';
import { gerarPdfOrdem } from '../../services/pdfOrdemService';
import { addDespesa, addPrestacao, deleteDespesa, getDespesasPorPrestacao } from '../../storage/storage';
import { estado as estadoPrint, prepararFalhas, resetPrint } from '../mocks/expo-print';
import { arquivos } from '../mocks/memoria';
import {
  criarCategoria,
  criarDespesas,
  criarOrdem,
  criarPrestacao,
  resetAmbiente,
} from '../helpers/fixtures';

const CICLOS = 20;

describe('estabilidade — geração repetida de PDF da prestação', () => {
  beforeEach(() => resetAmbiente());

  test(`${CICLOS} gerações seguidas sempre produzem PDF válido e com o mesmo formato`, async () => {
    const prestacao = criarPrestacao();
    const despesas = criarDespesas(40);
    const categorias = [criarCategoria(1)];

    const tamanhos: number[] = [];
    const chamadasPorCiclo: number[] = [];
    const caminhos = new Set<string>();

    for (let ciclo = 0; ciclo < CICLOS; ciclo += 1) {
      const caminho = await gerarPdfPrestacao(prestacao, despesas, categorias, {
        intervaloMs: 0,
      });

      const conteudo = arquivos.get(caminho)?.base64 ?? '';
      expect(conteudo.startsWith('JVBERi')).toBe(true);
      tamanhos.push(conteudo.length);
      chamadasPorCiclo.push(estadoPrint.chamadas.length);
      caminhos.add(caminho);
      resetPrint();
    }

    // Sem acúmulo de arquivos: cada geração reutiliza o mesmo destino.
    expect(caminhos.size).toBe(1);
    // A fatiagem é determinística: a mesma entrada gera sempre o mesmo nº de chamadas nativas.
    expect(new Set(chamadasPorCiclo).size).toBe(1);
    // O arquivo final é estável (variação mínima entre ciclos).
    const minimo = Math.min(...tamanhos);
    const maximo = Math.max(...tamanhos);
    expect(maximo - minimo).toBeLessThanOrEqual(64);
  });

  test('geração da ordem de pagamento é estável com e sem imagem', async () => {
    const semImagem = criarOrdem({ id: 'o1', numero: 'OP-001', imagemUri: '' });
    const comImagem = criarOrdem({ id: 'o2', numero: 'OP-002' });

    for (let ciclo = 0; ciclo < CICLOS; ciclo += 1) {
      const caminhoSem = await gerarPdfOrdem(semImagem, { intervaloMs: 0 });
      const caminhoCom = await gerarPdfOrdem(comImagem, { intervaloMs: 0 });

      expect(arquivos.get(caminhoSem)?.base64.startsWith('JVBERi')).toBe(true);
      expect(arquivos.get(caminhoCom)?.base64.startsWith('JVBERi')).toBe(true);
      resetPrint();
    }
  });

  test('falha intermitente da nativa é absorvida pelo retry sem perder dados', async () => {
    const prestacao = criarPrestacao();
    const despesas = criarDespesas(5);
    const categorias = [criarCategoria(1)];

    for (let ciclo = 0; ciclo < 10; ciclo += 1) {
      // Falha de 3 em 3 chamadas, alternando entre "vazio" e exceção.
      prepararFalhas(ciclo % 2 === 0 ? 1 : 2, ciclo % 3 === 0 ? 'vazio' : 'erro');
      const caminho = await gerarPdfPrestacao(prestacao, despesas, categorias, {
        tentativas: 4,
        intervaloMs: 0,
      });
      expect(arquivos.get(caminho)?.base64.startsWith('JVBERi')).toBe(true);
      resetPrint();
    }
  });
});

describe('estabilidade — armazenamento sob ciclos de escrita', () => {
  beforeEach(() => resetAmbiente());

  test('200 ciclos de criar/ler/excluir despesas mantêm os dados consistentes', async () => {
    const prestacao = await addPrestacao({ descricao: 'Soak', valorRecebido: 10000 });

    for (let i = 0; i < 200; i += 1) {
      const despesa = await addDespesa({
        prestacaoId: prestacao.id,
        descricao: `Item ${i}`,
        categoriaId: 'cat-1',
        valor: 10,
        cupomUri: '',
      });

      const lidas = await getDespesasPorPrestacao(prestacao.id);
      expect(lidas).toHaveLength(1);
      expect(lidas[0].id).toBe(despesa.id);
      expect(lidas[0].descricao).toBe(`Item ${i}`);

      await deleteDespesa(despesa.id);
      expect(await getDespesasPorPrestacao(prestacao.id)).toHaveLength(0);
    }

    expect(await getDespesasPorPrestacao(prestacao.id)).toHaveLength(0);
  });

  test('nenhum PDF órfão acumula-se após gerações e exclusões repetidas', async () => {
    const pdfsDoInicio = [...arquivos.keys()].filter((k) => k.endsWith('.pdf')).length;

    for (let i = 0; i < 30; i += 1) {
      const caminho = await gerarPdfPrestacao(criarPrestacao(), criarDespesas(3), [
        criarCategoria(1),
      ]);
      expect(arquivos.has(caminho)).toBe(true);
      resetPrint();
      await FileSystem.deleteAsync(caminho);
      expect(arquivos.has(caminho)).toBe(false);
    }

    const pdfsDoFim = [...arquivos.keys()].filter((k) => k.endsWith('.pdf')).length;
    expect(pdfsDoFim).toBe(pdfsDoInicio);
  });
});
