import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Platform, RefreshControl } from 'react-native';
import { Text, Card, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getFuncionarios,
  getFechamentos,
} from '../../../storage/storageDiarias';
import { DiariaFuncionario, DiariaFechamento } from '../../../types';
import { gerarPdfPagamentoPeriodo, gerarPdfResumoPagamento, abrirPdfDiaria } from '../../../services/pdfDiariaService';
import { formatarMoeda } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, CARD, FONT } from '../../../constants/theme';

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

function formatarDataISO(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

interface FuncionarioPeriodo {
  funcionario: DiariaFuncionario;
  fechamentos: DiariaFechamento[];
  totalDias: number;
  valorTotal: number;
}

export default function RealizarPagamentos() {
  const [periodoInicio, setPeriodoInicio] = useState(new Date());
  const [periodoFim, setPeriodoFim] = useState(new Date());
  const [mostrarInicio, setMostrarInicio] = useState(false);
  const [mostrarFim, setMostrarFim] = useState(false);
  const [funcionarios, setFuncionarios] = useState<FuncionarioPeriodo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const funcs = await getFuncionarios();
    const todosFechamentos = await getFechamentos();
    const inicio = periodoInicio.getTime();
    const fim = periodoFim.getTime();

    const fechamentosNoPeriodo = todosFechamentos
      .filter((fc) => {
        const d = new Date(fc.fechadoEm).getTime();
        return d >= inicio && d <= fim;
      })
      .sort((a, b) => new Date(b.fechadoEm).getTime() - new Date(a.fechadoEm).getTime());

    const resultado: FuncionarioPeriodo[] = [];

    for (const f of funcs) {
      const fech = fechamentosNoPeriodo.filter((fc) => fc.funcionarioId === f.id);
      if (fech.length === 0) continue;
      const totalDias = fech.reduce((s, fc) => s + fc.totalDias, 0);
      const valorTotal = fech.reduce((s, fc) => s + fc.valorTotal, 0);
      resultado.push({ funcionario: f, fechamentos: fech, totalDias, valorTotal });
    }

    setFuncionarios(resultado);
  }, [periodoInicio, periodoFim]);

  useFocusEffect(useCallback(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]));

  const aoPuxarParaAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const aoMudarInicio = (event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarInicio(Platform.OS === 'ios');
    if (dataSelecionada) setPeriodoInicio(dataSelecionada);
  };

  const aoMudarFim = (event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarFim(Platform.OS === 'ios');
    if (dataSelecionada) setPeriodoFim(dataSelecionada);
  };

  const gerarRelatorio = async () => {
    if (funcionarios.length === 0) return;
    setGerandoPdf(true);
    try {
      const uri = await gerarPdfPagamentoPeriodo(funcionarios, periodoInicio, periodoFim);
      await abrirPdfDiaria(uri);
    } catch (e: any) {
      console.error('Erro ao gerar relatório:', e);
      Alert.alert('Erro', 'Não foi possível gerar o relatório.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const gerarResumo = async () => {
    if (funcionarios.length === 0) return;
    setGerandoResumo(true);
    try {
      const ultimoPorFuncionario: FuncionarioPeriodo[] = funcionarios.map((f) => {
        const ultimo = f.fechamentos[0];
        return {
          funcionario: f.funcionario,
          fechamentos: [ultimo],
          totalDias: ultimo.totalDias,
          valorTotal: ultimo.valorTotal,
        };
      });
      const uri = await gerarPdfResumoPagamento(ultimoPorFuncionario, periodoInicio, periodoFim);
      await abrirPdfDiaria(uri);
    } catch (e) {
      console.error('Erro ao gerar resumo:', e);
      Alert.alert('Erro', 'Não foi possível gerar o resumo.');
    } finally {
      setGerandoResumo(false);
    }
  };

  const valorTotalGeral = funcionarios.reduce((s, f) => s + f.valorTotal, 0);

  return (
    <View style={styles.container}>
      <View style={styles.filtroContainer}>
        <View style={styles.instrucaoContainer}>
          <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} />
          <Text style={styles.instrucaoTexto}>Selecione o período para gerar relatório de pagamentos</Text>
        </View>
        <View style={styles.filtroHeader}>
          <Text style={styles.filtroTitulo}>Período</Text>
        </View>
        <View style={styles.filtroRow}>
          <TouchableOpacity onPress={() => setMostrarInicio(true)} style={styles.filtroInput}>
            <TextInput label="Início" mode="outlined" value={formatarData(periodoInicio)} editable={false} dense right={<TextInput.Icon icon="calendar" />} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMostrarFim(true)} style={styles.filtroInput}>
            <TextInput label="Fim" mode="outlined" value={formatarData(periodoFim)} editable={false} dense right={<TextInput.Icon icon="calendar" />} />
          </TouchableOpacity>
        </View>
        {mostrarInicio && (
          <DateTimePicker value={periodoInicio} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={aoMudarInicio} locale="pt-BR" />
        )}
        {mostrarFim && (
          <DateTimePicker value={periodoFim} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={aoMudarFim} locale="pt-BR" />
        )}

        <View style={styles.botoesFiltro}>
          <Button
            mode="contained"
            icon="file-pdf-box"
            compact
            buttonColor={COLORS.primary}
            onPress={gerarRelatorio}
            loading={gerandoPdf}
            disabled={gerandoPdf || gerandoResumo}
            style={styles.botaoFiltro}
            accessibilityLabel="Gerar relatório PDF"
          >
            Relatório PDF
          </Button>
          <Button
            mode="outlined"
            icon="file-document-outline"
            compact
            onPress={gerarResumo}
            loading={gerandoResumo}
            disabled={gerandoPdf || gerandoResumo}
            style={styles.botaoFiltro}
            accessibilityLabel="Gerar resumo pagamento"
          >
            Resumo Pagamento
          </Button>
        </View>
      </View>

      {carregando ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <>
          {funcionarios.length > 0 && (
            <View style={styles.resumoBar}>
              <Text style={styles.resumoTexto}>{funcionarios.length} funcionário{funcionarios.length > 1 ? 's' : ''}</Text>
              <Text style={styles.resumoValor}>Total: {formatarMoeda(valorTotalGeral)}</Text>
            </View>
          )}

          <FlatList
            data={funcionarios}
            keyExtractor={(item) => item.funcionario.id}
            contentContainerStyle={styles.lista}
            refreshControl={
              <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="account-outline" size={64} color={COLORS.textMuted} />
                <Text style={styles.emptyTitulo}>Nenhum funcionário</Text>
                <Text style={styles.emptySubtitulo}>Nenhum fechamento no período selecionado.</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
            renderItem={({ item }) => {
              const ultimo = item.fechamentos[0];
              const totalAdicionais = item.fechamentos.reduce((s, fc) => s + fc.valorAdicionais, 0);
              return (
                <Card style={styles.card}>
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.cardTopo}>
                      <View style={styles.avatar}>
                        <MaterialCommunityIcons name="account" size={22} color={COLORS.primary} />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.nome}>{item.funcionario.nome}</Text>
                        <Text style={styles.funcao}>{item.funcionario.funcao}</Text>
                      </View>
                      <View style={styles.valorTotalContainer}>
                        <Text style={styles.valorTotal}>{formatarMoeda(item.valorTotal)}</Text>
                        <View style={styles.fechamentosBadge}>
                          <Text style={styles.fechamentosBadgeTexto}>{item.fechamentos.length} fechamento{item.fechamentos.length > 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                    </View>

                    <Divider style={styles.cardDivider} />

                    <View style={styles.cardDetalhes}>
                      <View style={styles.detalheItem}>
                        <MaterialCommunityIcons name="calendar-range" size={15} color={COLORS.textSecondary} />
                        <Text style={styles.detalheTexto}>
                          {formatarDataISO(ultimo.periodoInicio)} a {formatarDataISO(ultimo.periodoFim)}
                        </Text>
                      </View>
                      <View style={styles.detalheItem}>
                        <MaterialCommunityIcons name="calendar-check" size={15} color={COLORS.textSecondary} />
                        <Text style={styles.detalheTexto}>{item.totalDias} dia{item.totalDias > 1 ? 's' : ''}</Text>
                      </View>
                      <View style={styles.detalheItem}>
                        <MaterialCommunityIcons name="key-variant" size={15} color={COLORS.textSecondary} />
                        <Text style={styles.detalheTexto} numberOfLines={1}>{item.funcionario.pixInfo}</Text>
                      </View>
                    </View>

                    <View style={styles.cardValores}>
                      <View style={styles.valorPill}>
                        <MaterialCommunityIcons name="cash" size={14} color={COLORS.primary} />
                        <Text style={styles.valorLabel}>Diária: {formatarMoeda(item.funcionario.valorDiaria)}</Text>
                      </View>
                      {totalAdicionais > 0 && (
                        <View style={styles.valorPill}>
                          <MaterialCommunityIcons name="plus-circle-outline" size={14} color={COLORS.primary} />
                          <Text style={styles.valorAdicional}>Adicionais: {formatarMoeda(totalAdicionais)}</Text>
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filtroContainer: { padding: SPACING.lg, marginBottom: SPACING.md, ...CARD },
  instrucaoContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, padding: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.sm, marginBottom: SPACING.md },
  instrucaoTexto: { ...FONT.captionStrong, color: COLORS.primary, flex: 1 },
  filtroHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  filtroTitulo: { ...FONT.captionStrong, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  filtroRow: { flexDirection: 'row', gap: SPACING.sm },
  filtroInput: { flex: 1 },
  botoesFiltro: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  botaoFiltro: { flex: 1, borderRadius: RADIUS.pill },

  resumoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.primaryLight, marginBottom: SPACING.sm },
  resumoTexto: { ...FONT.captionStrong, color: COLORS.primary },
  resumoValor: { ...FONT.captionStrong, color: COLORS.primary },

  lista: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl },
  emptyContainer: { alignItems: 'center', marginTop: 64, paddingHorizontal: SPACING.xl },
  emptyTitulo: { ...FONT.h3, color: COLORS.textPrimary, marginTop: SPACING.md },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs },

  card: { ...CARD },
  cardContent: { paddingTop: SPACING.md },
  cardTopo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  cardInfo: { flex: 1 },
  nome: { ...FONT.bodyStrong },
  funcao: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 2 },
  valorTotalContainer: { alignItems: 'flex-end' },
  valorTotal: { ...FONT.h3, color: COLORS.primary },
  fechamentosBadge: { marginTop: 3, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 1 },
  fechamentosBadgeTexto: { ...FONT.smallStrong, color: COLORS.primary },

  cardDivider: { marginVertical: SPACING.md },

  cardDetalhes: { gap: SPACING.sm },
  detalheItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detalheTexto: { ...FONT.caption, color: COLORS.textSecondary, flexShrink: 1 },

  cardValores: { marginTop: SPACING.sm, flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  valorPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3, gap: 4 },
  valorLabel: { ...FONT.captionStrong, color: COLORS.primary },
  valorAdicional: { ...FONT.captionStrong, color: COLORS.primary },
});
