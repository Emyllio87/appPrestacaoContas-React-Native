import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getOrdensPagamento, deleteOrdemPagamento, updateOrdemPagamento } from '../../storage/storageOrdens';
import { OrdemPagamento } from '../../types';
import { formatarMoeda } from '../../utils/formatacao';
import { gerarPdfOrdem, abrirPdfOrdem, compartilharPdfOrdem } from '../../services/pdfOrdemService';
import { COLORS, SPACING, RADIUS, CARD, FONT, withAlpha } from '../../constants/theme';

function formatarDataHora(data: Date): string {
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataFormatada} às ${horaFormatada}`;
}

export default function HistoricoOrdens() {
  const router = useRouter();
  const [ordens, setOrdens] = useState<OrdemPagamento[]>([]);
  const [gerandoPdf, setGerandoPdf] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async () => {
    const dados = await getOrdensPagamento();
    dados.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
    setOrdens(dados);
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
    Alert.alert('Excluir', 'Deseja excluir esta ordem de pagamento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteOrdemPagamento(id);
          carregar();
        },
      },
    ]);
  };

  const toggleStatus = async (ordem: OrdemPagamento) => {
    const novoStatus = ordem.status === 'pendente' ? 'autorizado' : 'pendente';
    await updateOrdemPagamento(ordem.id, { status: novoStatus });
    carregar();
  };

  const gerarPdf = async (ordem: OrdemPagamento) => {
    setGerandoPdf(ordem.id);
    try {
      const uri = await gerarPdfOrdem(ordem);
      await abrirPdfOrdem(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(null);
    }
  };

  const compartilharPdf = async (ordem: OrdemPagamento) => {
    setGerandoPdf(ordem.id);
    try {
      const uri = await gerarPdfOrdem(ordem);
      await compartilharPdfOrdem(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar.');
    } finally {
      setGerandoPdf(null);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={ordens}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.warning]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhuma ordem</Text>
            <Text style={styles.emptySubtitulo}>Ordens de pagamento aparecerão aqui.</Text>
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
                      onPress={() => toggleStatus(item)}
                      style={[styles.statusBadge, item.status === 'pendente' ? styles.statusPendente : styles.statusAutorizado]}
                    >
                      <Text style={styles.statusTexto}>{item.status === 'pendente' ? 'Pendente' : 'Autorizado'}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardLinha}>
                    <Text style={styles.cardLabel}>Fornecedor</Text>
                    <Text style={styles.cardValor}>{item.fornecedor}</Text>
                  </View>
                  <View style={styles.cardLinha}>
                    <Text style={styles.cardLabel}>Assunto</Text>
                    <Text style={styles.cardValor}>{item.assunto}</Text>
                  </View>
                  <View style={styles.cardLinha}>
                    <Text style={styles.cardLabel}>Valor</Text>
                    <Text style={styles.cardValorDestaque}>{formatarMoeda(item.valor)}</Text>
                  </View>
                  <View style={styles.cardLinha}>
                    <Text style={styles.cardLabel}>Data</Text>
                    <Text style={styles.cardValor}>{formatarData(item.criadoEm)}</Text>
                  </View>
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
                    onPress={() => router.push({ pathname: `/ordens-pagamento/${item.id}/editar-ordem` })}
                  />
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={COLORS.danger}
                    onPress={() => confirmarExcluir(item.id)}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  cardNumero: { ...FONT.bodyStrong, color: COLORS.warning },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.md,
  },
  statusPendente: { backgroundColor: withAlpha(COLORS.warning, '20') },
  statusAutorizado: { backgroundColor: withAlpha(COLORS.success, '20') },
  statusTexto: { ...FONT.smallStrong, color: COLORS.textPrimary },
  cardLinha: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cardLabel: { ...FONT.caption, color: COLORS.textSecondary },
  cardValor: { ...FONT.captionStrong, color: COLORS.textPrimary },
  cardValorDestaque: { ...FONT.captionStrong, color: COLORS.success },
  botoesHeader: { flexDirection: 'row', gap: SPACING.lg },
});
