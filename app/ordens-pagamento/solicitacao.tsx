import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Menu } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { COLORS, SPACING, RADIUS, FONT, CARD } from '../../constants/theme';
import { addOrdemPagamento, obterProximoNumeroOrdem } from '../../storage/storageOrdens';
import { gerarArquivoPdf } from '../../services/pdfWriter';
import { TipoChavePix, OrdemPagamento } from '../../types';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput, formatarMoeda } from '../../utils/formatacao';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';

interface ItemOrdem {
  id: string;
  fornecedor: string;
  tipoChavePix: TipoChavePix;
  pixInfo: string;
  valor: string;
  assunto: string;
}

const CHAVES_PIX: { value: TipoChavePix; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
];

export default function SolicitacaoOrdemPagamento() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemOrdem[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [numero, setNumero] = useState('');

  const [fornecedor, setFornecedor] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState<TipoChavePix>('cpf');
  const [pixInfo, setPixInfo] = useState('');
  const [valor, setValor] = useState('');
  const [assunto, setAssunto] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    const carregarNumero = async () => {
      const proximoNumero = await obterProximoNumeroOrdem();
      setNumero(proximoNumero);
    };
    carregarNumero();
  }, []);

  const limparCampos = () => {
    setFornecedor('');
    setTipoChavePix('cpf');
    setPixInfo('');
    setValor('');
    setAssunto('');
  };

  const adicionarItem = () => {
    if (!fornecedor.trim() || !pixInfo.trim() || !valor.trim() || !assunto.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }
    if (!valorMoedaValido(valor)) {
      Alert.alert('Atenção', 'Valor inválido.');
      return;
    }

    const novoItem: ItemOrdem = {
      id: String(Date.now()),
      fornecedor: fornecedor.trim(),
      tipoChavePix,
      pixInfo: pixInfo.trim(),
      valor,
      assunto: assunto.trim(),
    };

    setItens((prev) => [...prev, novoItem]);
    limparCampos();
  };

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const salvar = async () => {
    if (itens.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos uma ordem.');
      return;
    }

    try {
      for (const item of itens) {
        await addOrdemPagamento({
          fornecedor: item.fornecedor,
          tipoChavePix: item.tipoChavePix,
          pixInfo: item.pixInfo,
          valor: parsearMoeda(item.valor),
          assunto: item.assunto,
          imagemUri: '',
        });
      }
      Alert.alert('Sucesso', `${itens.length} ordem(ns) salva(s)!`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    }
  };

  const gerarPdf = async () => {
    if (itens.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos uma ordem.');
      return;
    }

    setGerandoPdf(true);
    try {
      const dataAtual = new Date();
      const dataFormatada = `${String(dataAtual.getDate()).padStart(2, '0')}/${String(dataAtual.getMonth() + 1).padStart(2, '0')}/${dataAtual.getFullYear()}`;

      const linhas = itens
        .map(
          (item, i) => `
          <tr>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; text-align: center; width: 30px;">${i + 1}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; font-weight: normal;">${item.fornecedor}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px;">${item.assunto}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; text-align: right; font-weight: normal;">${formatarMoeda(parsearMoeda(item.valor))}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; color: #757575;">${CHAVES_PIX.find((c) => c.value === item.tipoChavePix)?.label}: ${item.pixInfo}</td>
          </tr>
        `
        )
        .join('');

      const totalGeral = itens.reduce((s, item) => s + parsearMoeda(item.valor), 0);

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4; margin: 0; }
              html, body { font-family: Helvetica, Arial, sans-serif;                 color: #1A1A1A; width: 794px; height: 1123px; overflow: hidden; }
              .pagina { position: relative; width: 794px; height: 1123px; padding: 32px; display: flex; flex-direction: column; }
              .header {
                text-align: center;
                padding-bottom: 16px;
                border-bottom: 1px solid #E0E0E0;
                margin-bottom: 28px;
              }
              .header h1 { font-size: 20px; margin-bottom: 2px; }
              .header .numero { font-size: 14px; font-weight: bold; }
              .header .gerado { font-size: 9px; color: #9E9E9E; margin-top: 2px; }
              .dados h2 { font-size: 13px; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; margin-bottom: 8px; color: #1A1A1A; }
              .dados table { width: 100%; font-size: 13px; }
              .dados td { padding: 5px 0; border-bottom: 1px solid #F0F0F0; }
              .dados .campo-label { font-weight: normal; color: #757575; width: 120px; font-size: 12px; }
              .dados .campo-valor { font-weight: 600; font-size: 13px; }
              .itens-titulo { font-size: 13px; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; margin-top: 16px; margin-bottom: 8px; color: #1A1A1A; }
              .tabela { width: 100%; border-collapse: collapse; }
              .tabela th { color: #1A1A1A; font-size: 10px; padding: 8px 10px; text-align: left; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #D0D0D0; }
              .tabela th:nth-child(1) { text-align: center; width: 30px; }
              .tabela th:nth-child(4) { text-align: right; }
              .tabela td { font-size: 12px; padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-weight: normal; }
              .resumo { margin-top: 12px; text-align: right; font-size: 12px; color: #757575; }
              .resumo strong { font-size: 14px; color: #1A1A1A; font-weight: 600; }
              .footer { position: absolute; bottom: 24px; left: 32px; right: 32px; text-align: center; border-top: 1px solid #F0F0F0; padding-top: 10px; font-size: 8px; color: #BDBDBD; }
            </style>
          </head>
          <body>
            <div class="pagina">
              <div class="header">
                <h1>SOLICITAÇÃO DE ORDEM DE PAGAMENTO</h1>
                <div class="numero">${numero}</div>
                <div class="gerado">Gerado em ${dataFormatada}</div>
              </div>

              <div class="dados">
                <h2>Dados da Solicitação</h2>
                <table>
                  <tr><td class="campo-label">Número</td><td class="campo-valor">${numero}</td></tr>
                  <tr><td class="campo-label">Data</td><td class="campo-valor">${dataFormatada}</td></tr>
                  <tr><td class="campo-label">Total de ordens</td><td class="campo-valor">${itens.length}</td></tr>
                </table>
              </div>

              <div class="itens-titulo">Ordens de Pagamento</div>
              <table class="tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Fornecedor</th>
                    <th>Assunto</th>
                    <th>Valor</th>
                    <th>PIX</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
              </table>

              <div class="resumo">
                <strong>Valor total: ${formatarMoeda(totalGeral)}</strong>
              </div>

              <div class="footer">Documento gerado automaticamente · ${dataFormatada}</div>
            </div>
          </body>
        </html>
      `;

      const destino = await gerarArquivoPdf(html, `solicitacao_op_${numero}.pdf`);

      await Print.printAsync({ uri: destino });
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const labelTipoChave = CHAVES_PIX.find((c) => c.value === tipoChavePix)?.label ?? '';

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleMedium" style={styles.titulo}>
        Solicitação de Ordem de Pagamento
      </Text>
      <Text style={styles.numero}>Número: {numero}</Text>

      <View style={styles.formCard}>
        <TextInput
          label="Fornecedor *"
          mode="outlined"
          value={fornecedor}
          onChangeText={setFornecedor}
          style={styles.campo}
          dense
        />

        <Menu
          visible={menuAberto}
          onDismiss={() => setMenuAberto(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuAberto(true)}
              style={styles.campo}
              contentStyle={{ flexDirection: 'row', justifyContent: 'space-between' }}
              labelStyle={{ color: COLORS.textPrimary }}
            >
              {labelTipoChave || 'Tipo de chave PIX'}
            </Button>
          }
        >
          {CHAVES_PIX.map((c) => (
            <Menu.Item
              key={c.value}
              title={c.label}
              onPress={() => {
                setTipoChavePix(c.value);
                setMenuAberto(false);
              }}
            />
          ))}
        </Menu>

        <TextInput
          label="Chave PIX *"
          mode="outlined"
          value={pixInfo}
          onChangeText={setPixInfo}
          style={styles.campo}
          dense
        />

        <TextInput
          label="Valor *"
          mode="outlined"
          value={valor}
          onChangeText={(t) => setValor(formatarMoedaInput(t))}
          keyboardType="numeric"
          style={styles.campo}
          left={<TextInput.Affix text="R$" />}
          dense
        />

        <TextInput
          label="Assunto *"
          mode="outlined"
          value={assunto}
          onChangeText={setAssunto}
          style={styles.campo}
          dense
        />

        <Button
          mode="contained"
          icon="plus"
          buttonColor={COLORS.primary}
          onPress={adicionarItem}
          style={styles.botaoAdicionar}
        >
          Adicionar ordem
        </Button>
      </View>

      {itens.length > 0 && (
        <>
          <View style={styles.tabelaHeader}>
            <Text style={[styles.colHeader, styles.colNum]}>#</Text>
            <Text style={[styles.colHeader, styles.colFornecedor]}>Fornecedor</Text>
            <Text style={[styles.colHeader, styles.colAssunto]}>Assunto</Text>
            <Text style={[styles.colHeader, styles.colValor]}>Valor</Text>
            <View style={styles.colAcao} />
          </View>

          {itens.map((item, index) => (
            <View key={item.id} style={[styles.linhaItem, index % 2 === 1 && styles.linhaAlternada]}>
              <Text style={[styles.colValorTexto, styles.colNum]}>{index + 1}</Text>
              <Text style={[styles.colValorTexto, styles.colFornecedor]}>{item.fornecedor}</Text>
              <Text style={[styles.colValorTexto, styles.colAssunto]}>{item.assunto}</Text>
              <Text style={[styles.colValorTexto, styles.colValor]}>{formatarMoeda(parsearMoeda(item.valor))}</Text>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={COLORS.danger}
                onPress={() => removerItem(item.id)}
                style={styles.colAcao}
              />
            </View>
          ))}

          <View style={styles.botoes}>
            <Button
              mode="contained"
              icon="content-save"
              buttonColor={COLORS.primary}
              onPress={salvar}
              style={styles.botaoSalvar}
            >
              Salvar Solicitação
            </Button>
            <Button
              mode="contained"
              icon="file-pdf-box"
              buttonColor={COLORS.primary}
              onPress={gerarPdf}
              loading={gerandoPdf}
              disabled={gerandoPdf}
              style={styles.botaoPdf}
            >
              Gerar PDF
            </Button>
          </View>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  titulo: { ...FONT.h3, color: COLORS.textPrimary },
  numero: { ...FONT.bodyStrong, color: COLORS.primary, marginBottom: SPACING.lg },
  formCard: {
    ...CARD,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  campo: { marginBottom: SPACING.sm },
  botaoAdicionar: { marginTop: SPACING.xs, borderRadius: RADIUS.pill },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  colHeader: {
    ...FONT.smallStrong,
    color: COLORS.surface,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  colNum: { width: 30, textAlign: 'center' },
  colFornecedor: { flex: 2 },
  colAssunto: { flex: 1.5 },
  colValor: { flex: 1, textAlign: 'right' },
  colAcao: { width: 24, textAlign: 'center' },
  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  linhaAlternada: { backgroundColor: COLORS.background },
  colValorTexto: { ...FONT.caption, color: COLORS.textPrimary },
  botoes: { marginTop: SPACING.lg, gap: SPACING.sm },
  botaoSalvar: { borderRadius: RADIUS.pill },
  botaoPdf: { borderRadius: RADIUS.pill },
});
