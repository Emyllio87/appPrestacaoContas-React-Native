import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getPrestacoes,
  getDespesasPorPrestacao,
  getCategorias,
  fecharPrestacao,
  abrirPrestacao,
  deleteDespesa,
} from '../../../storage/storage';
import { gerarPdfPrestacao, abrirPdf } from '../../../services/pdfService';
import { somarValores } from '../../../services/pdfCore';
import { formatarMoeda } from '../../../utils/formatacao';
import { Prestacao, Despesa, Categoria } from '../../../types';
import { COLORS, SPACING, RADIUS, SHADOW, FONT } from '../../../constants/theme';

export default function DetalhePrestacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [prestacao, setPrestacao] = useState<Prestacao | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const carregar = useCallback(async () => {
    const [todasPrestacoes, despesasDaPrestacao, cats] = await Promise.all([
      getPrestacoes(),
      getDespesasPorPrestacao(id),
      getCategorias(),
    ]);
    setPrestacao(todasPrestacoes.find((p) => p.id === id) ?? null);
    setDespesas(despesasDaPrestacao);
    setCategorias(cats);
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

  const abrirPdfDireto = async () => {
    if (!prestacao) return;
    setGerandoPdf(true);
    try {
      const uri = await gerarPdfPrestacao(prestacao, despesas, categorias);
      await abrirPdf(uri);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  if (carregando || !prestacao) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const totalGasto = somarValores(despesas.map((d) => d.valor));
  const saldo = prestacao.valorRecebido - totalGasto;
  const nomeCategoria = (idCat: string) => categorias.find((c) => c.id === idCat)?.nome ?? 'Sem categoria';

  const confirmarFechamento = () => {
    Alert.alert(
      'Fechar prestação',
      saldo >= 0
        ? `Saldo caixa de ${formatarMoeda(saldo)}. Depois de fechada, não será possível editar. Confirmar?`
        : `Reembolso devido de ${formatarMoeda(Math.abs(saldo))}. Depois de fechada, não será possível editar. Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fechar',
          style: 'destructive',
          onPress: async () => {
            setGerandoPdf(true);
            try {
              await fecharPrestacao(prestacao.id, saldo);

              // Recarrega do storage: o estado em memória ainda está desatualizado
              // e o PDF sairia com os dados de antes do fechamento.
              const [prestacoesAtualizadas, despesasAtuais, cats] = await Promise.all([
                getPrestacoes(),
                getDespesasPorPrestacao(prestacao.id),
                getCategorias(),
              ]);
              const prestacaoAtualizada =
                prestacoesAtualizadas.find((p) => p.id === prestacao.id) ?? prestacao;

              setPrestacao(prestacaoAtualizada);
              setDespesas(despesasAtuais);
              setCategorias(cats);

              const uri = await gerarPdfPrestacao(prestacaoAtualizada, despesasAtuais, cats);
              await abrirPdf(uri);
            } catch {
              Alert.alert('Erro', 'Não foi possível fechar a prestação e gerar o PDF.');
              await carregar();
            } finally {
              setGerandoPdf(false);
            }
          },
        },
      ]
    );
  };

  const confirmarExclusaoDespesa = (despesaId: string) => {
    Alert.alert('Excluir despesa', 'Tem certeza que deseja excluir esta despesa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteDespesa(despesaId);
          carregar();
        },
      },
    ]);
  };

  const reabrirPrestacao = () => {
    Alert.alert(
      'Reabrir prestação',
      'A prestação voltará ao status aberta. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reabrir',
          onPress: async () => {
            await abrirPrestacao(prestacao.id);
            carregar();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.resumoCard}>
        <Card.Content>
          <Text style={styles.resumoTitulo}>{prestacao.descricao}</Text>
          <View style={styles.resumoLinha}>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Recebido</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(prestacao.valorRecebido)}</Text>
            </View>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Gasto</Text>
              <Text style={styles.resumoValor}>{formatarMoeda(totalGasto)}</Text>
            </View>
            <View style={styles.resumoItem}>
              <Text style={styles.resumoLabel}>Saldo</Text>
              <Text style={[styles.resumoValor, saldo >= 0 ? styles.sucesso : styles.perigo]}>
                {formatarMoeda(saldo)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {prestacao.status === 'aberta' ? (
        <View style={styles.botoes}>
          <Button
            mode="contained"
            icon="plus"
            style={styles.botaoMeio}
            buttonColor={COLORS.primary}
            onPress={() => router.push(`/prestacao/${prestacao.id}/nova-despesa`)}
            accessibilityLabel="Adicionar nova despesa"
          >
            Despesa
          </Button>
          <Button
            mode="contained"
            icon="file-pdf-box"
            style={styles.botaoMeio}
            buttonColor={COLORS.primary}
            onPress={abrirPdfDireto}
            loading={gerandoPdf}
            disabled={gerandoPdf}
            accessibilityLabel="Visualizar PDF da prestação"
          >
            PDF
          </Button>
          <Button
            mode="contained"
            icon="check-circle-outline"
            style={styles.botaoMeio}
            buttonColor={COLORS.primary}
            onPress={confirmarFechamento}
            disabled={despesas.length === 0}
            accessibilityLabel="Fechar prestação de contas"
          >
            Fechar
          </Button>
        </View>
      ) : (
        <View style={styles.botoes}>
          <Button
            mode="contained"
            icon="pencil"
            style={styles.botaoMeio}
            buttonColor={COLORS.primary}
            onPress={() => router.push(`/prestacao/${prestacao.id}/editar-prestacao`)}
            accessibilityLabel="Editar prestação"
          >
            Editar
          </Button>
          <Button
            mode="contained"
            icon="lock-open-variant"
            style={styles.botaoMeio}
            buttonColor={COLORS.primary}
            onPress={reabrirPrestacao}
            accessibilityLabel="Reabrir prestação de contas"
          >
            Reabrir
          </Button>
          <Button
            mode="contained"
            icon="file-pdf-box"
            style={styles.botaoMeio}
            buttonColor={COLORS.primary}
            onPress={abrirPdfDireto}
            loading={gerandoPdf}
            disabled={gerandoPdf}
            accessibilityLabel="Ver PDF da prestação"
          >
            PDF
          </Button>
        </View>
      )}

      <FlatList
        data={despesas}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        ItemSeparatorComponent={() => <Divider style={styles.divider} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="receipt" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhuma despesa</Text>
            <Text style={styles.emptySubtitulo}>Toque em "Despesa" para adicionar.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.despesaLinha}>
            <View style={styles.despesaInfo}>
              <Text style={styles.despesaNome}>{item.descricao}</Text>
              <Text style={styles.despesaMeta}>
                {nomeCategoria(item.categoriaId)} · {new Date(item.data).toLocaleDateString('pt-BR')}
              </Text>
            </View>
            <Text style={styles.despesaValor}>{formatarMoeda(item.valor)}</Text>
            <View style={styles.despesaAcoes}>
              <IconButton
                icon="pencil-outline"
                size={18}
                iconColor={COLORS.primary}
                onPress={() => router.push(`/prestacao/${prestacao.id}/editar-despesa?despesaId=${item.id}`)}
                accessibilityLabel={`Editar despesa ${item.descricao}`}
              />
              <IconButton
                icon="delete-outline"
                size={18}
                iconColor={COLORS.danger}
                onPress={() => confirmarExclusaoDespesa(item.id)}
                accessibilityLabel={`Excluir despesa ${item.descricao}`}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  resumoCard: { margin: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, ...SHADOW.sm },
  resumoTitulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  resumoLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  resumoItem: { alignItems: 'flex-start' },
  resumoLabel: { ...FONT.small, color: COLORS.textSecondary },
  resumoValor: { ...FONT.title, color: COLORS.textPrimary },
  sucesso: { color: COLORS.primary },
  perigo: { color: COLORS.danger },
  botoes: { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.sm },
  botaoMeio: { flex: 1 },
  lista: { padding: SPACING.md },
  divider: { marginVertical: 4 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyTitulo: { ...FONT.bodyStrong, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textMuted, marginTop: 4 },
  despesaLinha: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs },
  despesaInfo: { flex: 1 },
  despesaNome: { ...FONT.captionStrong, color: COLORS.textPrimary },
  despesaMeta: { ...FONT.small, color: COLORS.textSecondary, marginTop: 2 },
  despesaValor: { ...FONT.captionStrong, color: COLORS.textPrimary, marginRight: SPACING.xs },
  despesaAcoes: { flexDirection: 'row' },
});
