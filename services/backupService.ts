import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  getPrestacoes,
  getDespesas,
  getCategorias,
  importarPrestacao,
  importarCategoria,
  importarDespesa,
} from '../storage/storage';
import { Prestacao, Despesa, Categoria } from '../types';

interface DespesaBackup extends Despesa {
  cupomBase64?: string;
}

interface BackupDados {
  versao: number;
  exportadoEm: string;
  prestacoes: Prestacao[];
  despesas: DespesaBackup[];
  categorias: Categoria[];
}

const NOME_ARQUIVO = 'prestacao_contas_backup.json';

async function imagemParaBase64(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return '';
  }
}

async function base64ParaArquivo(base64: string, nomeArquivo: string): Promise<string> {
  const caminho = `${FileSystem.documentDirectory}cupons/${nomeArquivo}`;
  const pasta = `${FileSystem.documentDirectory}cupons/`;
  await FileSystem.makeDirectoryAsync(pasta, { intermediates: true }).catch(() => {});

  try {
    await FileSystem.writeAsStringAsync(caminho, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return caminho;
  } catch {
    return '';
  }
}

export async function exportarDados(): Promise<void> {
  const [prestacoes, despesas, categorias] = await Promise.all([
    getPrestacoes(),
    getDespesas(),
    getCategorias(),
  ]);

  const despesasComImagens = await Promise.all(
    despesas.map(async (d) => ({
      ...d,
      cupomBase64: d.cupomUri ? await imagemParaBase64(d.cupomUri) : '',
    }))
  );

  const dados = {
    versao: 2,
    exportadoEm: new Date().toISOString(),
    prestacoes,
    despesas: despesasComImagens,
    categorias,
  };

  const json = JSON.stringify(dados, null, 2);
  const caminho = `${FileSystem.documentDirectory}${NOME_ARQUIVO}`;

  await FileSystem.writeAsStringAsync(caminho, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(caminho, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar dados da prestação de contas',
  });
}

export async function importarDados(): Promise<{ sucesso: boolean; mensagem: string }> {
  try {
    const resultado = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (resultado.canceled || !resultado.assets?.[0]) {
      return { sucesso: false, mensagem: 'Importação cancelada' };
    }

    const uri = resultado.assets[0].uri;

    let conteudo: string;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        return { sucesso: false, mensagem: 'Arquivo não encontrado' };
      }

      const response = await fetch(uri);
      conteudo = await response.text();
    } catch (erro) {
      return { sucesso: false, mensagem: `Não foi possível ler o arquivo: ${erro instanceof Error ? erro.message : 'Erro desconhecido'}` };
    }

    let dados: BackupDados;
    try {
      dados = JSON.parse(conteudo);
    } catch {
      return { sucesso: false, mensagem: 'Arquivo JSON inválido ou corrompido' };
    }

    if (!dados.prestacoes || !dados.despesas || !dados.categorias) {
      return { sucesso: false, mensagem: 'Arquivo de backup inválido (faltam dados)' };
    }

    const prestacoesExistentes = await getPrestacoes();
    const despesasExistentes = await getDespesas();
    const categoriasExistentes = await getCategorias();

    const idsPrestacoesExistentes = new Set(prestacoesExistentes.map((p) => p.id));
    const idsCategoriasExistentes = new Set(categoriasExistentes.map((c) => c.id));

    let prestacoesImportadas = 0;
    let despesasImportadas = 0;
    let categoriasImportadas = 0;

    for (const cat of dados.categorias) {
      if (!idsCategoriasExistentes.has(cat.id)) {
        await importarCategoria(cat);
        categoriasImportadas++;
      }
    }

    for (const p of dados.prestacoes) {
      if (!idsPrestacoesExistentes.has(p.id)) {
        await importarPrestacao(p);
        prestacoesImportadas++;
      }
    }

    const todasPrestacoes = await getPrestacoes();
    const idsPrestacoesFinais = new Set(todasPrestacoes.map((p) => p.id));

    const todasCategorias = await getCategorias();
    const mapaCategorias = new Map(todasCategorias.map((c) => [c.nome, c.id]));

    for (const d of dados.despesas) {
      if (!idsPrestacoesFinais.has(d.prestacaoId)) continue;

      const existe = despesasExistentes.some(
        (de) => de.id === d.id && de.prestacaoId === d.prestacaoId
      );

      if (!existe) {
        let cupomUri = d.cupomUri;

        if (d.cupomBase64) {
          const nomeArquivo = `cupom_${d.id}.jpg`;
          cupomUri = await base64ParaArquivo(d.cupomBase64, nomeArquivo);
        }

        const categoriaEncontrada = dados.categorias.find((c) => c.id === d.categoriaId);
        await importarDespesa({
          ...d,
          categoriaId: mapaCategorias.get(categoriaEncontrada?.nome ?? '') ?? d.categoriaId,
          cupomUri,
        });
        despesasImportadas++;
      }
    }

    return {
      sucesso: true,
      mensagem: `Importado: ${prestacoesImportadas} prestações, ${despesasImportadas} despesas, ${categoriasImportadas} categorias`,
    };
  } catch (erro) {
    return { sucesso: false, mensagem: `Erro ao importar: ${erro instanceof Error ? erro.message : 'Desconhecido'}` };
  }
}
