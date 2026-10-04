import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { COLORS, SPACING, RADIUS, FONT, CARD } from '../../constants/theme';
import { salvarPedido, obterProximoNumero } from '../../storage/storagePedidos';
import { gerarArquivoPdf } from '../../services/pdfWriter';
import { PedidoCotacao, ItemCotacao } from '../../types';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';

export default function CotacaoPedidos() {
  const router = useRouter();
  const [itens, setItens] = useState<ItemCotacao[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [numero, setNumero] = useState('');

  const [assunto, setAssunto] = useState('');
  const [material, setMaterial] = useState('');
  const [unidade, setUnidade] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    const carregarNumero = async () => {
      const proximoNumero = await obterProximoNumero();
      setNumero(proximoNumero);
    };
    carregarNumero();
  }, []);

  const limparCampos = () => {
    setMaterial('');
    setUnidade('');
    setQuantidade('');
    setObservacao('');
  };

  const adicionarItem = () => {
    if (!material.trim() || !unidade.trim() || !quantidade.trim()) {
      Alert.alert('Atenção', 'Preencha material, unidade e quantidade.');
      return;
    }

    const novoItem: ItemCotacao = {
      id: String(Date.now()),
      material: material.trim(),
      unidade: unidade.trim(),
      quantidade: quantidade.trim(),
      observacao: observacao.trim(),
    };

    setItens((prev) => [...prev, novoItem]);
    limparCampos();
  };

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const salvar = async () => {
    if (!assunto.trim()) {
      Alert.alert('Atenção', 'Preencha o assunto.');
      return;
    }
    if (itens.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um item.');
      return;
    }

    try {
      const pedido: PedidoCotacao = {
        id: String(Date.now()),
        numero,
        assunto: assunto.trim(),
        data: new Date().toISOString(),
        status: 'pendente',
        itens: [...itens],
        criadoEm: new Date().toISOString(),
      };
      await salvarPedido(pedido);
      Alert.alert('Sucesso', 'Solicitação salva!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    }
  };

  const gerarPdf = async () => {
    if (!assunto.trim()) {
      Alert.alert('Atenção', 'Preencha o assunto.');
      return;
    }
    if (itens.length === 0) {
      Alert.alert('Atenção', 'Adicione pelo menos um item.');
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
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; font-weight: normal;">${item.material}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; text-align: center;">${item.unidade}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; text-align: center;">${item.quantidade}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-size: 12px; color: #757575;">${item.observacao || '-'}</td>
          </tr>
        `
        )
        .join('');

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              @page { size: A4; margin: 0; }
              html, body {
                font-family: Helvetica, Arial, sans-serif;
                color: #1A1A1A;
                width: 794px;
                height: 1123px;
                overflow: hidden;
              }
              .pagina {
                position: relative;
                width: 794px;
                height: 1123px;
                padding: 32px;
                display: flex;
                flex-direction: column;
              }
              .header {
                text-align: center;
                padding-bottom: 16px;
                border-bottom: 1px solid #E0E0E0;
                margin-bottom: 28px;
              }
              .header h1 {
                font-size: 20px;
                margin-bottom: 2px;
              }
              .header .numero {
                font-size: 14px;
                font-weight: bold;
              }
              .header .gerado {
                font-size: 9px;
                color: #9E9E9E;
                margin-top: 2px;
              }
              .dados h2 {
                font-size: 13px;
                border-bottom: 1px solid #E0E0E0;
                padding-bottom: 4px;
                margin-bottom: 8px;
                color: #1A1A1A;
              }
              .dados table {
                width: 100%;
                font-size: 13px;
              }
              .dados td {
                padding: 5px 0;
                border-bottom: 1px solid #F0F0F0;
              }
              .dados .campo-label {
                font-weight: normal;
                color: #757575;
                width: 120px;
                font-size: 12px;
              }
              .dados .campo-valor {
                font-weight: 600;
                font-size: 13px;
              }
              .itens-titulo {
                font-size: 13px;
                border-bottom: 1px solid #E0E0E0;
                padding-bottom: 4px;
                margin-top: 16px;
                margin-bottom: 8px;
                color: #1A1A1A;
              }
              .tabela { width: 100%; border-collapse: collapse; }
              .tabela th { color: #1A1A1A; font-size: 10px; padding: 8px 10px; text-align: left; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #D0D0D0; }
              .tabela th:nth-child(1) { text-align: center; width: 30px; }
              .tabela th:nth-child(3) { text-align: center; }
              .tabela th:nth-child(4) { text-align: center; }
              .tabela td { font-size: 12px; padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-weight: normal; }
              .footer {
                position: absolute;
                bottom: 24px;
                left: 32px;
                right: 32px;
                text-align: center;
                border-top: 1px solid #F0F0F0;
                padding-top: 10px;
                font-size: 8px;
                color: #BDBDBD;
              }
            </style>
          </head>
          <body>
            <div class="pagina">
              <div class="header">
                <h1>SOLICITAÇÃO DE ORÇAMENTO</h1>
                <div class="numero">${numero}</div>
                <div class="gerado">Gerado em ${dataFormatada}</div>
              </div>

              <div class="dados">
                <h2>Dados da Solicitação</h2>
                <table>
                  <tr>
                    <td class="campo-label">Número</td>
                    <td class="campo-valor">${numero}</td>
                  </tr>
                  <tr>
                    <td class="campo-label">Assunto</td>
                    <td class="campo-valor">${assunto}</td>
                  </tr>
                  <tr>
                    <td class="campo-label">Data</td>
                    <td class="campo-valor">${dataFormatada}</td>
                  </tr>
                  <tr>
                    <td class="campo-label">Total de itens</td>
                    <td class="campo-valor">${itens.length}</td>
                  </tr>
                </table>
              </div>

              <div class="itens-titulo">Itens para Cotação</div>
              <table class="tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Material</th>
                    <th>Unidade</th>
                    <th>Quantidade</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>${linhas}</tbody>
              </table>

              <div class="footer">
                Documento gerado automaticamente · ${dataFormatada}
              </div>
            </div>
          </body>
        </html>
      `;

      const destino = await gerarArquivoPdf(html, `solicitacao_${numero}.pdf`);

      await Print.printAsync({ uri: destino });
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleMedium" style={styles.titulo}>
        Solicitação de Orçamento
      </Text>
      <Text style={styles.numero}>Número: {numero}</Text>

      <View style={styles.formCard}>
        <TextInput
          label="Assunto *"
          mode="outlined"
          value={assunto}
          onChangeText={setAssunto}
          style={styles.campo}
          dense
        />

        <TextInput
          label="Material *"
          mode="outlined"
          value={material}
          onChangeText={setMaterial}
          style={styles.campo}
          dense
        />

        <View style={styles.linha}>
          <TextInput
            label="Unidade *"
            mode="outlined"
            value={unidade}
            onChangeText={setUnidade}
            placeholder="kg, un, m, l"
            style={[styles.campo, styles.campoPequeno]}
            dense
          />
          <TextInput
            label="Quantidade *"
            mode="outlined"
            value={quantidade}
            onChangeText={setQuantidade}
            keyboardType="numeric"
            style={[styles.campo, styles.campoPequeno]}
            dense
          />
        </View>

        <TextInput
          label="Observação"
          mode="outlined"
          value={observacao}
          onChangeText={setObservacao}
          multiline
          numberOfLines={2}
          style={styles.campo}
        />

        <Button
          mode="contained"
          icon="plus"
          buttonColor={COLORS.primary}
          onPress={adicionarItem}
          style={styles.botaoAdicionar}
        >
          Adicionar item
        </Button>
      </View>

      {itens.length > 0 && (
        <>
          <View style={styles.tabelaHeader}>
            <Text style={[styles.colHeader, styles.colNum]}>#</Text>
            <Text style={[styles.colHeader, styles.colMaterial]}>Material</Text>
            <Text style={[styles.colHeader, styles.colUnidade]}>Unid</Text>
            <Text style={[styles.colHeader, styles.colQtd]}>Qtd</Text>
            <Text style={[styles.colHeader, styles.colObs]}>Obs</Text>
            <View style={styles.colAcao} />
          </View>

          {itens.map((item, index) => (
            <View key={item.id} style={[styles.linhaItem, index % 2 === 1 && styles.linhaAlternada]}>
              <Text style={[styles.colValor, styles.colNum]}>{index + 1}</Text>
              <Text style={[styles.colValor, styles.colMaterial]}>{item.material}</Text>
              <Text style={[styles.colValor, styles.colUnidade]}>{item.unidade}</Text>
              <Text style={[styles.colValor, styles.colQtd]}>{item.quantidade}</Text>
              <Text style={[styles.colValor, styles.colObs]}>{item.observacao || '-'}</Text>
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
  linha: { flexDirection: 'row', gap: SPACING.sm },
  campoPequeno: { flex: 1 },
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
  colMaterial: { flex: 2 },
  colUnidade: { flex: 1, textAlign: 'center' },
  colQtd: { flex: 1, textAlign: 'center' },
  colObs: { flex: 1.5 },
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
  colValor: { ...FONT.caption, color: COLORS.textPrimary },
  botoes: { marginTop: SPACING.lg, gap: SPACING.sm },
  botaoSalvar: { borderRadius: RADIUS.pill },
  botaoPdf: { borderRadius: RADIUS.pill },
});
