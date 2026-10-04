import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, Button, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getFuncionarios,
  getRegistrosPendentes,
  deleteRegistro,
} from '../../../storage/storageDiarias';
import { DiariaFuncionario, DiariaRegistro, TipoChavePix } from '../../../types';
import { formatarMoeda } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, SHADOW, FONT } from '../../../constants/theme';

const LABELS_CHAVE: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
};

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataCompleta(data: string): string {
  const d = new Date(data);
  const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
}

export default function DetalheFuncionario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [funcionario, setFuncionario] = useState<DiariaFuncionario | null>(null);
  const [registros, setRegistros] = useState<DiariaRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const funcionarios = await getFuncionarios();
    const f = funcionarios.find((item) => item.id === id) ?? null;
    setFuncionario(f);
    if (f) {
      const regs = await getRegistrosPendentes(f.id);
      regs.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setRegistros(regs);
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

  const confirmarExclusaoRegistro = (registroId: string) => {
    Alert.alert('Excluir registro', 'Remover este dia trabalhado?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await deleteRegistro(registroId);
          carregar();
        },
      },
    ]);
  };

  if (carregando || !funcionario) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const totalDias = registros.length;
  const totalAdicionais = registros.reduce((soma, r) => soma + (r.valorAdicional ?? 0), 0);
  const valorTotal = totalDias * funcionario.valorDiaria + totalAdicionais;

  return (
    <View style={styles.container}>
      <Card style={styles.resumoCard}>
        <Card.Content>
          <View style={styles.resumoHeader}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={36} color={COLORS.primary} />
            </View>
            <View style={styles.resumoInfo}>
              <Text style={styles.resumoNome}>{funcionario.nome}</Text>
              <Text style={styles.resumoFuncao}>{funcionario.funcao}</Text>
              {funcionario.pixInfo ? (
                <View style={styles.pixLinha}>
                  <Text style={styles.pixTipo}>Pix:</Text>
                  <Text style={styles.pixTexto} numberOfLines={1}>{LABELS_CHAVE[funcionario.tipoChavePix]} · {funcionario.pixInfo}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Divider style={styles.resumoDivider} />

          <View style={styles.resumoValores}>
            <View style={styles.valorItem}>
              <Text style={styles.valorLabel}>Diária</Text>
              <Text style={styles.valorValor}>{formatarMoeda(funcionario.valorDiaria)}</Text>
            </View>
            <View style={styles.valorDivisor} />
            <View style={styles.valorItem}>
              <Text style={styles.valorLabel}>Dias</Text>
              <Text style={styles.valorValor}>{totalDias}</Text>
            </View>
            <View style={styles.valorDivisor} />
            <View style={styles.valorItem}>
              <Text style={styles.valorLabel}>Adicionais</Text>
              <Text style={styles.valorValor}>{formatarMoeda(totalAdicionais)}</Text>
            </View>
          </View>

          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total a receber</Text>
            <Text style={styles.totalValor}>{formatarMoeda(valorTotal)}</Text>
            {totalDias > 0 && (
              <Text style={styles.totalDetalhe}>
                {totalDias} dia{totalDias > 1 ? 's' : ''} × {formatarMoeda(funcionario.valorDiaria)}
              </Text>
            )}
          </View>
        </Card.Content>
      </Card>

      <FlatList
        data={registros}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        ListHeaderComponent={
          <View style={styles.listaHeader}>
            <Text style={styles.listaTitulo}>Dias trabalhados</Text>
            {totalDias > 0 && (
              <View style={styles.contadorChip}>
                <Text style={styles.contadorTexto}>{totalDias}</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhum dia trabalhado</Text>
            <Text style={styles.emptySubtitulo}>Toque em "Registrar dia" para começar.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const adicional = item.valorAdicional ?? 0;
          return (
            <View style={styles.diaCard}>
              <View style={styles.diaIcone}>
                <MaterialCommunityIcons name="calendar-check" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.diaInfo}>
                <Text style={styles.diaData}>{formatarData(item.data)}</Text>
                <Text style={styles.diaSemana}>{formatarDataCompleta(item.data)}</Text>
                {item.observacao ? (
                  <Text style={styles.diaObs}>{item.observacao}</Text>
                ) : null}
              </View>
              <View style={styles.diaValores}>
                <Text style={styles.diaValor}>
                  {formatarMoeda(funcionario.valorDiaria + adicional)}
                </Text>
                {adicional > 0 ? (
                  <Text style={styles.diaAdicional}>
                    +{formatarMoeda(adicional)} adicional
                  </Text>
                ) : null}
              </View>
              <IconButton icon="pencil-outline" size={18} iconColor={COLORS.primary} onPress={() => router.push(`/diarias/${funcionario.id}/editar-registro?registroId=${item.id}`)} accessibilityLabel={`Editar registro ${formatarData(item.data)}`} />
              <IconButton icon="delete-outline" size={18} iconColor={COLORS.danger} onPress={() => confirmarExclusaoRegistro(item.id)} accessibilityLabel={`Excluir dia ${formatarData(item.data)}`} />
            </View>
          );
        }}
      />

      <View style={styles.botoesBar}>
        <View style={styles.botoesSecundarios}>
          <Button mode="outlined" icon="history" style={styles.botao} onPress={() => router.push(`/diarias/${funcionario.id}/historico`)} accessibilityLabel="Histórico de fechamentos">
            Histórico
          </Button>
          <Button mode="outlined" icon="plus" style={styles.botao} onPress={() => router.push(`/diarias/${funcionario.id}/registrar-dia`)} accessibilityLabel="Registrar dia trabalhado">
            Registrar
          </Button>
        </View>
        <Button mode="contained" icon="check" style={styles.botaoPrincipal} buttonColor={COLORS.primary} textColor={COLORS.onPrimary} onPress={() => router.push(`/diarias/${funcionario.id}/fechar-pagamento`)} disabled={registros.length === 0} accessibilityLabel="Fechar pagamento">
          Fechar pagamento
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  resumoCard: { marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, ...SHADOW.md },
  resumoHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  resumoInfo: { flex: 1 },
  resumoNome: { ...FONT.title, color: COLORS.textPrimary },
  resumoFuncao: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 2 },
  pixLinha: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: SPACING.xs, maxWidth: '100%' },
  pixTipo: { ...FONT.smallStrong, color: COLORS.textSecondary },
  pixTexto: { ...FONT.small, color: COLORS.textSecondary, flexShrink: 1, marginLeft: 2 },
  resumoDivider: { marginHorizontal: SPACING.md },
  resumoValores: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  valorItem: { alignItems: 'center', flex: 1 },
  valorDivisor: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: COLORS.border, marginHorizontal: SPACING.sm },
  valorLabel: { ...FONT.small, color: COLORS.textSecondary, textAlign: 'center' },
  valorValor: { ...FONT.bodyStrong, color: COLORS.textPrimary, marginTop: 2, textAlign: 'center' },
  totalContainer: { alignItems: 'center', backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, marginHorizontal: SPACING.md, marginBottom: SPACING.md, paddingVertical: SPACING.md },
  totalLabel: { ...FONT.captionStrong, color: COLORS.primary, letterSpacing: 0.3 },
  totalValor: { ...FONT.h2, color: COLORS.primary, marginTop: 2 },
  totalDetalhe: { ...FONT.caption, color: COLORS.primary, opacity: 0.8, marginTop: 4 },
  botoesBar: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 70, backgroundColor: COLORS.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border, ...SHADOW.sm },
  botoesSecundarios: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.sm },
  botao: { flex: 1 },
  botaoPrincipal: { marginTop: SPACING.xs },
  lista: { padding: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xl },
  listaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  listaTitulo: { ...FONT.captionStrong, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  contadorChip: { marginLeft: SPACING.sm, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  contadorTexto: { ...FONT.smallStrong, color: COLORS.primary },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyTitulo: { ...FONT.bodyStrong, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textMuted, marginTop: 4 },
  diaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, ...SHADOW.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm },
  diaIcone: { marginRight: SPACING.sm, width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  diaInfo: { flex: 1 },
  diaData: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  diaSemana: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 1, textTransform: 'capitalize' },
  diaObs: { ...FONT.caption, color: COLORS.textMuted, marginTop: 2 },
  diaValores: { alignItems: 'flex-end', marginRight: SPACING.xs },
  diaValor: { ...FONT.bodyStrong, color: COLORS.primary },
  diaAdicional: { ...FONT.small, color: COLORS.primary, opacity: 0.7, marginTop: 1 },
});
