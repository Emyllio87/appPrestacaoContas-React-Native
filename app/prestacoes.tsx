import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, IconButton, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getPrestacoes, deletePrestacao, getDespesasPorPrestacao, getCategorias } from '../storage/storage';
import { Prestacao } from '../types';
import { formatarMoeda } from '../utils/formatacao';
import { COLORS, SPACING, RADIUS, CARD, FONT } from '../constants/theme';
import { gerarPdfPrestacao, compartilharPdf } from '../services/pdfService';
import { somarValores } from '../services/pdfCore';

interface PrestacaoComSaldo extends Prestacao {
  totalGasto: number;
}

export default function Prestacoes() {
  const router = useRouter();
  const [prestacoes, setPrestacoes] = useState<PrestacaoComSaldo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const dados = await getPrestacoes();
    dados.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    const comSaldo = await Promise.all(
      dados.map(async (p) => {
        const despesas = await getDespesasPorPrestacao(p.id);
        const totalGasto = somarValores(despesas.map((d) => d.valor));
        return { ...p, totalGasto };
      })
    );

    setPrestacoes(comSaldo);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setCarregando(true);
      carregar().finally(() => setCarregando(false));
    }, [carregar])
  );

  const aoPuxarParaAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const confirmarExclusao = async (prestacao: PrestacaoComSaldo) => {
    const despesas = await getDespesasPorPrestacao(prestacao.id);

    if (despesas.length > 0) {
      Alert.alert(
        'Excluir prestação',
        `A prestação "${prestacao.descricao}" possui ${despesas.length} despesa(s). Todos os dados serão excluídos. Confirmar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              await deletePrestacao(prestacao.id);
              carregar();
            },
          },
        ]
      );
    } else {
      await deletePrestacao(prestacao.id);
      carregar();
    }
  };

  const compartilharPrestacao = async (prestacao: PrestacaoComSaldo) => {
    try {
      const despesas = await getDespesasPorPrestacao(prestacao.id);
      const categorias = await getCategorias();
      const uri = await gerarPdfPrestacao(prestacao, despesas, categorias);
      await compartilharPdf(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar a prestação.');
    }
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating color={COLORS.primary} />
      </View>
    );
  }

  if (prestacoes.length === 0) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="file-document-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.emptyTitulo}>Nenhuma prestação</Text>
        <Text style={styles.emptySubtitulo}>Crie a primeira prestação de contas.</Text>
        <Button
          mode="contained"
          icon="plus"
          onPress={() => router.push('/nova-prestacao')}
          buttonColor={COLORS.primary}
          style={styles.botaoNovo}
          accessibilityLabel="Criar nova prestação de contas"
        >
          Nova prestação
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={prestacoes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <Button
            mode="contained"
            icon="plus"
            onPress={() => router.push('/nova-prestacao')}
            buttonColor={COLORS.primary}
            style={styles.botaoNovo}
            accessibilityLabel="Criar nova prestação de contas"
          >
            Nova prestação
          </Button>
        }
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        renderItem={({ item }) => {
          const saldo = item.valorRecebido - item.totalGasto;
          const isFechada = item.status === 'fechada';

          return (
            <Card
              style={styles.card}
              onPress={() => router.push(`/prestacao/${item.id}`)}
              accessibilityLabel={`Prestação ${item.descricao}, ${isFechada ? 'fechada' : 'aberta'}`}
            >
              <Card.Content>
                <View style={styles.cardTopo}>
                  <Text style={styles.cardTitulo} numberOfLines={1}>{item.descricao}</Text>
                  <Chip
                    compact
                    style={[
                      styles.statusChip,
                      isFechada
                        ? item.saldoTipo === 'reembolso'
                          ? styles.statusPerigo
                          : styles.statusSucesso
                        : styles.statusAlerta,
                    ]}
                    textStyle={[
                      styles.statusTexto,
                      isFechada
                        ? item.saldoTipo === 'reembolso'
                          ? styles.statusTextoPerigo
                          : styles.statusTextoSucesso
                        : styles.statusTextoAlerta,
                    ]}
                  >
                    {isFechada ? 'Fechada' : 'Aberta'}
                  </Chip>
                </View>

                <View style={styles.cardValores}>
                  <View style={styles.cardLinha}>
                    <Text style={styles.cardLabel}>Recebido</Text>
                    <Text style={styles.cardValor}>{formatarMoeda(item.valorRecebido)}</Text>
                  </View>
                  <View style={styles.cardLinha}>
                    <Text style={styles.cardLabel}>Gasto</Text>
                    <Text style={styles.cardValor}>{formatarMoeda(item.totalGasto)}</Text>
                  </View>
                  {isFechada && item.saldoTipo === 'caixa' && (
                    <View style={styles.cardLinha}>
                      <Text style={styles.cardLabel}>Saldo caixa</Text>
                      <Text style={styles.cardValorDestaque}>{formatarMoeda(item.saldoValor ?? 0)}</Text>
                    </View>
                  )}
                  {isFechada && item.saldoTipo === 'reembolso' && (
                    <View style={styles.cardLinha}>
                      <Text style={styles.cardLabel}>Reembolso</Text>
                      <Text style={styles.cardValorPerigo}>{formatarMoeda(item.saldoValor ?? 0)}</Text>
                    </View>
                  )}
                  {!isFechada && (
                    <View style={styles.cardLinha}>
                      <Text style={styles.cardLabel}>Saldo</Text>
                      <Text style={saldo >= 0 ? styles.cardValorDestaque : styles.cardValorPerigo}>
                        {formatarMoeda(saldo)}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardBotoes}>
                  {!isFechada && (
                    <IconButton
                      icon="pencil-outline"
                      size={18}
                      iconColor={COLORS.primary}
                      onPress={() => router.push(`/prestacao/${item.id}/editar-prestacao`)}
                      accessibilityLabel={`Editar prestação ${item.descricao}`}
                    />
                  )}
                  {isFechada && (
                    <IconButton
                      icon="share-variant"
                      size={18}
                      iconColor={COLORS.primary}
                      onPress={() => compartilharPrestacao(item)}
                      accessibilityLabel={`Compartilhar prestação ${item.descricao}`}
                    />
                  )}
                  <IconButton
                    icon="delete-outline"
                    size={18}
                    iconColor={COLORS.danger}
                    onPress={() => confirmarExclusao(item)}
                    accessibilityLabel={`Excluir prestação ${item.descricao}`}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  lista: { padding: SPACING.md },
  emptyTitulo: { ...FONT.h3, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },
  botaoNovo: { marginBottom: SPACING.md, borderRadius: RADIUS.pill },
  card: { marginBottom: SPACING.sm, ...CARD },
  cardTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
  cardTitulo: { flex: 1, ...FONT.bodyStrong, color: COLORS.textPrimary, marginRight: SPACING.xs },
  cardValores: { marginBottom: SPACING.xs },
  cardLinha: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  cardLabel: { ...FONT.caption, color: COLORS.textSecondary },
  cardValor: { ...FONT.captionStrong, color: COLORS.textPrimary },
  cardValorDestaque: { ...FONT.captionStrong, color: COLORS.success },
  cardValorPerigo: { ...FONT.captionStrong, color: COLORS.danger },
  cardBotoes: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.xs },
  statusChip: {},
  statusSucesso: { backgroundColor: COLORS.successLight },
  statusPerigo: { backgroundColor: COLORS.dangerLight },
  statusAlerta: { backgroundColor: COLORS.warningLight },
  statusTexto: { ...FONT.smallStrong },
  statusTextoSucesso: { color: COLORS.success },
  statusTextoPerigo: { color: COLORS.danger },
  statusTextoAlerta: { color: COLORS.warning },
});
