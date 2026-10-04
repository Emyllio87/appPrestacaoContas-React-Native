import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, SPACING, RADIUS, CARD, FONT, withAlpha } from '../../constants/theme';
import { gerarArquivoPdf } from '../../services/pdfWriter';
import { carregarPedidos, excluirPedido, atualizarPedido } from '../../storage/storagePedidos';
import { PedidoCotacao, StatusPedido } from '../../types';

export default function HistoricoPedidos() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoCotacao[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusPedido | 'todos'>('todos');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async () => {
    const dados = await carregarPedidos();
    setPedidos(dados.reverse());
  };

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [])
  );

  const aoPuxarParaAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const formatarData = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const confirmarExcluir = (id: string) => {
    Alert.alert('Excluir', 'Deseja excluir este pedido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await excluirPedido(id);
          carregar();
        },
      },
    ]);
  };

  const alternarStatus = async (pedido: PedidoCotacao) => {
    const novoStatus: StatusPedido = pedido.status === 'pendente' ? 'autorizado' : 'pendente';
    const pedidoAtualizado = { ...pedido, status: novoStatus };
    await atualizarPedido(pedidoAtualizado);
    carregar();
  };

  const pedidosFiltrados = filtroStatus === 'todos'
    ? pedidos
    : pedidos.filter((p) => p.status === filtroStatus);

  const gerarPdf = async (pedido: PedidoCotacao) => {
    setGerandoPdf(pedido.id);
    try {
      const dataFormatada = formatarData(pedido.data || pedido.criadoEm);
      const dataGeracao = new Date().toLocaleDateString('pt-BR');

      const linhas = pedido.itens
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
                <div class="numero">${pedido.numero}</div>
                <div class="gerado">Gerado em ${dataGeracao}</div>
              </div>

              <div class="dados">
                <h2>Dados da Solicitação</h2>
                <table>
                  <tr>
                    <td class="campo-label">Número</td>
                    <td class="campo-valor">${pedido.numero}</td>
                  </tr>
                  <tr>
                    <td class="campo-label">Assunto</td>
                    <td class="campo-valor">${pedido.assunto}</td>
                  </tr>
                  <tr>
                    <td class="campo-label">Data</td>
                    <td class="campo-valor">${dataFormatada}</td>
                  </tr>
                  <tr>
                    <td class="campo-label">Total de itens</td>
                    <td class="campo-valor">${pedido.itens.length}</td>
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
                Documento gerado automaticamente · ${dataGeracao}
              </div>
            </div>
          </body>
        </html>
      `;

      const destino = await gerarArquivoPdf(html, `solicitacao_${pedido.numero}.pdf`);

      await Print.printAsync({ uri: destino });
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(null);
    }
  };

  const compartilharPdf = async (pedido: PedidoCotacao) => {
    setGerandoPdf(pedido.id);
    try {
      const dataFormatada = formatarData(pedido.data || pedido.criadoEm);
      const dataGeracao = new Date().toLocaleDateString('pt-BR');

      const linhas = pedido.itens
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
              .header h1 { font-size: 20px; margin-bottom: 2px; }
              .header .numero { font-size: 14px; font-weight: bold; }
              .header .gerado { font-size: 9px; color: #9E9E9E; margin-top: 2px; }
              .dados h2 { font-size: 13px; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; margin-bottom: 8px; }
              .dados table { width: 100%; font-size: 13px; }
              .dados td { padding: 5px 0; border-bottom: 1px solid #F0F0F0; }
              .dados .campo-label { font-weight: bold; color: #616161; width: 120px; }
              .dados .campo-valor { font-weight: bold; font-size: 14px; }
              .itens-titulo { font-size: 13px; border-bottom: 1px solid #E0E0E0; padding-bottom: 4px; margin-top: 16px; margin-bottom: 8px; }
              .tabela { width: 100%; border-collapse: collapse; }
              .tabela th { color: #1A1A1A; font-size: 10px; padding: 8px 10px; text-align: left; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #D0D0D0; }
              .tabela th:nth-child(1) { text-align: center; width: 30px; }
              .tabela th:nth-child(3) { text-align: center; }
              .tabela th:nth-child(4) { text-align: center; }
              .tabela td { font-size: 10px; }
              .tabela tbody tr:last-child td { border-bottom: 2px solid #212121; }
              .footer { position: absolute; bottom: 24px; left: 32px; right: 32px; text-align: center; border-top: 1px solid #E0E0E0; padding-top: 6px; font-size: 8px; color: #BDBDBD; }
            </style>
          </head>
          <body>
            <div class="pagina">
              <div class="header">
                <h1>SOLICITAÇÃO DE ORÇAMENTO</h1>
                <div class="numero">${pedido.numero}</div>
                <div class="gerado">Gerado em ${dataGeracao}</div>
              </div>
              <div class="dados">
                <h2>Dados da Solicitação</h2>
                <table>
                  <tr><td class="campo-label">Número</td><td class="campo-valor">${pedido.numero}</td></tr>
                  <tr><td class="campo-label">Assunto</td><td class="campo-valor">${pedido.assunto}</td></tr>
                  <tr><td class="campo-label">Data</td><td class="campo-valor">${dataFormatada}</td></tr>
                  <tr><td class="campo-label">Total de itens</td><td class="campo-valor">${pedido.itens.length}</td></tr>
                </table>
              </div>
              <div class="itens-titulo">Itens para Cotação</div>
              <table class="tabela">
                <thead><tr><th>#</th><th>Material</th><th>Unidade</th><th>Quantidade</th><th>Observação</th></tr></thead>
                <tbody>${linhas}</tbody>
              </table>
              <div class="footer">Documento gerado automaticamente · ${dataGeracao}</div>
            </div>
          </body>
        </html>
      `;

      const destino = await gerarArquivoPdf(html, `solicitacao_${pedido.numero}.pdf`);

      const disponivel = await Sharing.isAvailableAsync();
      if (disponivel) {
        await Sharing.shareAsync(destino, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar solicitação',
        });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar.');
    } finally {
      setGerandoPdf(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filtroContainer}>
        <TouchableOpacity
          style={[styles.filtroBotao, filtroStatus === 'todos' && styles.filtroBotaoAtivo]}
          onPress={() => setFiltroStatus('todos')}
        >
          <Text style={[styles.filtroTexto, filtroStatus === 'todos' && styles.filtroTextoAtivo]}>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroBotao, filtroStatus === 'pendente' && styles.filtroBotaoPendente]}
          onPress={() => setFiltroStatus('pendente')}
        >
          <Text style={[styles.filtroTexto, filtroStatus === 'pendente' && styles.filtroTextoAtivo]}>Pendente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filtroBotao, filtroStatus === 'autorizado' && styles.filtroBotaoAutorizado]}
          onPress={() => setFiltroStatus('autorizado')}
        >
          <Text style={[styles.filtroTexto, filtroStatus === 'autorizado' && styles.filtroTextoAtivo]}>Autorizado</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pedidosFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhum pedido</Text>
            <Text style={styles.emptySubtitulo}>Solicitações de orçamento aparecerão aqui.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.cardInfo}>
                  <View style={styles.cardLinhaTopo}>
                    <Text style={styles.cardNumero}>{item.numero}</Text>
                    <TouchableOpacity
                      style={[styles.statusBadge, item.status === 'autorizado' ? styles.statusAutorizado : styles.statusPendente]}
                      onPress={() => alternarStatus(item)}
                    >
                      <Text style={styles.statusTexto}>
                        {item.status === 'autorizado' ? 'Autorizado' : 'Pendente'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.cardAssunto}>{item.assunto}</Text>
                  <Text style={styles.cardData}>{formatarData(item.data || item.criadoEm)}</Text>
                </View>
                <View style={styles.botoesHeader}>
                  <MaterialCommunityIcons
                    name="file-pdf-box"
                    size={20}
                    color={COLORS.danger}
                    onPress={() => gerarPdf(item)}
                  />
                  <MaterialCommunityIcons
                    name="share-variant"
                    size={20}
                    color={COLORS.primary}
                    onPress={() => compartilharPdf(item)}
                  />
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={20}
                    color={COLORS.primary}
                    onPress={() => router.push({ pathname: '/pedidos/editar', params: { id: item.id } })}
                  />
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={COLORS.danger}
                    onPress={() => confirmarExcluir(item.id)}
                  />
                </View>
              </View>

              <View style={styles.tabelaHeader}>
                <Text style={[styles.colHeader, styles.colNum]}>#</Text>
                <Text style={[styles.colHeader, styles.colMaterial]}>Material</Text>
                <Text style={[styles.colHeader, styles.colUnidade]}>Un</Text>
                <Text style={[styles.colHeader, styles.colQtd]}>Qtd</Text>
              </View>

              {item.itens.map((it, i) => (
                <View key={it.id} style={[styles.linhaItem, i % 2 === 1 && styles.linhaAlternada]}>
                  <Text style={[styles.colValor, styles.colNum]}>{i + 1}</Text>
                  <Text style={[styles.colValor, styles.colMaterial]}>{it.material}</Text>
                  <Text style={[styles.colValor, styles.colUnidade]}>{it.unidade}</Text>
                  <Text style={[styles.colValor, styles.colQtd]}>{it.quantidade}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  filtroContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    paddingBottom: 0,
  },
  filtroBotao: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filtroBotaoAtivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filtroBotaoPendente: { backgroundColor: COLORS.warning, borderColor: COLORS.warning },
  filtroBotaoAutorizado: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  filtroTexto: { ...FONT.caption, color: COLORS.textSecondary },
  filtroTextoAtivo: { ...FONT.captionStrong, color: COLORS.surface },
  lista: { padding: SPACING.md },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitulo: { ...FONT.h3, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textMuted, marginTop: 4 },
  card: { ...CARD },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  cardInfo: { flex: 1 },
  cardLinhaTopo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardNumero: { ...FONT.bodyStrong, color: COLORS.primary },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.md,
  },
  statusPendente: { backgroundColor: withAlpha(COLORS.warning, '20') },
  statusAutorizado: { backgroundColor: withAlpha(COLORS.success, '20') },
  statusTexto: { ...FONT.smallStrong, color: COLORS.textPrimary },
  cardAssunto: { ...FONT.bodyStrong, color: COLORS.textPrimary, marginTop: 4 },
  cardData: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 2 },
  botoesHeader: { flexDirection: 'row', gap: SPACING.lg },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: withAlpha(COLORS.primary, '10'),
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    marginBottom: 4,
  },
  colHeader: { ...FONT.smallStrong, color: COLORS.primary, textTransform: 'uppercase' },
  colNum: { width: 24, textAlign: 'center' },
  colMaterial: { flex: 2 },
  colUnidade: { flex: 1, textAlign: 'center' },
  colQtd: { flex: 1, textAlign: 'center' },
  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: SPACING.xs,
  },
  linhaAlternada: { backgroundColor: COLORS.background, borderRadius: RADIUS.sm },
  colValor: { ...FONT.caption, color: COLORS.textPrimary },
});
