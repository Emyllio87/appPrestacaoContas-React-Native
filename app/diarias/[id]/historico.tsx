import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getFuncionarios,
  getFechamentosPorFuncionario,
  getRegistrosPorFuncionario,
  deleteFechamento,
} from '../../../storage/storageDiarias';
import { DiariaFuncionario, DiariaFechamento } from '../../../types';
import { gerarPdfDiaria, gerarPdfGeralDiaria, abrirPdfDiaria, compartilharPdfDiaria } from '../../../services/pdfDiariaService';
import { formatarMoeda } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, CARD, FONT } from '../../../constants/theme';

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarPeriodo(inicio: string, fim: string): string {
  const formatar = (d: string) => {
    const data = new Date(d);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };
  return `${formatar(inicio)} a ${formatar(fim)}`;
}

const labelStatus: Record<string, string> = {
  pendente: 'Fechado',
  pago: 'Pago',
};

export default function Historico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [funcionario, setFuncionario] = useState<DiariaFuncionario | null>(null);
  const [fechamentos, setFechamentos] = useState<DiariaFechamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [gerandoRelatorioGeral, setGerandoRelatorioGeral] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const funcionarios = await getFuncionarios();
    const f = funcionarios.find((item) => item.id === id) ?? null;
    setFuncionario(f);
    if (f) {
      const fech = await getFechamentosPorFuncionario(f.id);
      setFechamentos(fech);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]));

  const aoPuxarParaAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const obterRegistrosDoFechamento = async (fechamento: DiariaFechamento) => {
    if (!funcionario) return [];
    const registros = await getRegistrosPorFuncionario(funcionario.id);
    return registros.filter((r) => r.fechamentoId === fechamento.id);
  };

  const abrirPdf = async (fechamento: DiariaFechamento) => {
    setProcessandoId(fechamento.id);
    try {
      const registros = await obterRegistrosDoFechamento(fechamento);
      const uri = await gerarPdfDiaria(funcionario!, registros, fechamento);
      await abrirPdfDiaria(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setProcessandoId(null);
    }
  };

  const compartilharPdf = async (fechamento: DiariaFechamento) => {
    setProcessandoId(fechamento.id);
    try {
      const registros = await obterRegistrosDoFechamento(fechamento);
      const uri = await gerarPdfDiaria(funcionario!, registros, fechamento);
      await compartilharPdfDiaria(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF para compartilhar.');
    } finally {
      setProcessandoId(null);
    }
  };

  const confirmarExclusao = (fechamento: DiariaFechamento) => {
    Alert.alert(
      'Excluir fechamento',
      `Excluir o fechamento de ${formatarData(fechamento.periodoInicio)} a ${formatarData(fechamento.periodoFim)}? Os registros voltarão a ficar pendentes.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteFechamento(fechamento.id);
            carregar();
          },
        },
      ]
    );
  };

  const totalFechamentos = fechamentos.length;
  const valorTotalGeral = fechamentos.reduce((soma, f) => soma + f.valorTotal, 0);

  const abrirRelatorioGeral = async () => {
    if (!funcionario || fechamentos.length === 0) return;
    setGerandoRelatorioGeral(true);
    try {
      const registros = await getRegistrosPorFuncionario(funcionario.id);
      const uri = await gerarPdfGeralDiaria(funcionario, fechamentos, registros);
      await abrirPdfDiaria(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o relatório geral.');
    } finally {
      setGerandoRelatorioGeral(false);
    }
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
        <Text style={styles.carregandoTexto}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {totalFechamentos > 0 && (
        <View style={styles.resumoHeader}>
          <View style={styles.resumoItem}>
            <MaterialCommunityIcons name="cash" size={20} color={COLORS.primary} />
            <Text style={styles.resumoValor}>{formatarMoeda(valorTotalGeral)}</Text>
            <Text style={styles.resumoLabel}>total geral</Text>
          </View>
          <View style={styles.resumoDivider} />
          <View style={styles.resumoItem}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color={COLORS.primary} />
            <Text style={styles.resumoValor}>{totalFechamentos}</Text>
            <Text style={styles.resumoLabel}>quinzena{totalFechamentos > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.resumoDivider} />
          <IconButton
            icon="file-pdf-box"
            size={28}
            iconColor={COLORS.primary}
            onPress={abrirRelatorioGeral}
            loading={gerandoRelatorioGeral}
            disabled={gerandoRelatorioGeral}
            accessibilityLabel="Relatório geral"
          />
        </View>
      )}

      <FlatList
        data={fechamentos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhum fechamento</Text>
            <Text style={styles.emptySubtitulo}>
              Feche um período na tela de detalhes para visualizar aqui.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        renderItem={({ item, index }) => {
          const processando = processandoId === item.id;
          return (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardTopo}>
                  <View style={styles.periodoContainer}>
                    <Text style={styles.periodoLabel}>Quinzena {index + 1}</Text>
                    <Text style={styles.periodoDatas}>{formatarPeriodo(item.periodoInicio, item.periodoFim)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'pago' ? COLORS.success : COLORS.warning }]}>
                    <Text style={styles.statusTexto}>{labelStatus[item.status]}</Text>
                  </View>
                </View>

                <View style={styles.cardDetalhes}>
                  <View style={styles.detalheItem}>
                    <MaterialCommunityIcons name="calendar" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detalheTexto}>{item.totalDias} dia{item.totalDias > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={styles.detalheItem}>
                    <MaterialCommunityIcons name="cash" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detalheTexto}>{formatarMoeda(item.valorTotal)}</Text>
                  </View>
                </View>

                <Divider style={styles.cardDivider} />

                <View style={styles.cardAcoes}>
                  <IconButton
                    icon="file-pdf-box"
                    size={20}
                    iconColor={COLORS.primary}
                    onPress={() => abrirPdf(item)}
                    loading={processando}
                    disabled={processando}
                    accessibilityLabel="Abrir PDF"
                  />
                  <IconButton
                    icon="share-variant"
                    size={20}
                    iconColor={COLORS.primary}
                    onPress={() => compartilharPdf(item)}
                    loading={processando}
                    disabled={processando}
                    accessibilityLabel="Compartilhar PDF"
                  />
                  <View style={{ flex: 1 }} />
                  <IconButton
                    icon="delete-outline"
                    size={20}
                    iconColor={COLORS.danger}
                    onPress={() => confirmarExclusao(item)}
                    accessibilityLabel="Excluir fechamento"
                  />
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  carregandoTexto: { marginTop: SPACING.sm, color: COLORS.textSecondary, ...FONT.caption },
  lista: { padding: SPACING.md },

  resumoHeader: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...CARD,
  },
  resumoItem: { flex: 1, alignItems: 'center', gap: 2 },
  resumoDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
  resumoValor: { ...FONT.h3, color: COLORS.textPrimary },
  resumoLabel: { ...FONT.caption, color: COLORS.textSecondary },

  emptyContainer: { alignItems: 'center', marginTop: 64, paddingHorizontal: SPACING.xl },
  emptyTitulo: { ...FONT.h3, color: COLORS.textPrimary, marginTop: SPACING.md },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 20 },

  card: { ...CARD },
  cardContent: { paddingVertical: SPACING.md },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  periodoContainer: { flex: 1 },
  periodoLabel: { ...FONT.captionStrong, color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  periodoDatas: { ...FONT.title, color: COLORS.textPrimary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill },
  statusTexto: { ...FONT.captionStrong, color: COLORS.surface },

  cardDetalhes: { flexDirection: 'row', marginTop: SPACING.sm, gap: SPACING.md },
  detalheItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detalheTexto: { ...FONT.caption, color: COLORS.textSecondary },

  cardDivider: { marginTop: SPACING.sm, marginBottom: SPACING.xs },

  cardAcoes: { flexDirection: 'row', alignItems: 'center' },
});
