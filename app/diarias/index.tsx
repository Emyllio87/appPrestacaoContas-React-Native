import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, IconButton, ActivityIndicator, Button } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFuncionarios, deleteFuncionario, getRegistrosPorFuncionario } from '../../storage/storageDiarias';
import { DiariaFuncionario } from '../../types';

import { COLORS, SPACING, RADIUS, CARD, FONT, withAlpha } from '../../constants/theme';

interface FuncionarioComDias extends DiariaFuncionario {
  diasTrabalhados: number;
}

export default function Diarias() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState<FuncionarioComDias[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    const dados = await getFuncionarios();
    const comDias = await Promise.all(
      dados.map(async (f) => {
        const registros = await getRegistrosPorFuncionario(f.id);
        return { ...f, diasTrabalhados: registros.length };
      })
    );
    setFuncionarios(comDias);
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

  const confirmarExclusao = (funcionario: FuncionarioComDias) => {
    Alert.alert(
      'Excluir funcionário',
      `Excluir "${funcionario.nome}" e todos os registros de dias? Confirmar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteFuncionario(funcionario.id);
            carregar();
          },
        },
      ]
    );
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={funcionarios}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        ListHeaderComponent={
          <Button
            mode="contained"
            icon="plus"
            onPress={() => router.push('/diarias/novo-funcionario')}
            buttonColor={COLORS.primary}
            style={styles.botaoNovo}
            accessibilityLabel="Adicionar funcionário"
          >
            Novo funcionário
          </Button>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="account-group-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhum funcionário</Text>
            <Text style={styles.emptySubtitulo}>Toque em "Novo funcionário" para cadastrar.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card
            style={styles.card}
            onPress={() => router.push(`/diarias/${item.id}`)}
            accessibilityLabel={`Funcionário ${item.nome}`}
          >
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="account" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNome}>{item.nome}</Text>
                <Text style={styles.cardFuncao}>{item.funcao}</Text>
              </View>
              <IconButton
                icon="pencil-outline"
                size={20}
                iconColor={COLORS.primary}
                onPress={() => router.push(`/diarias/${item.id}/editar-funcionario`)}
                accessibilityLabel={`Editar ${item.nome}`}
              />
              <IconButton
                icon="delete-outline"
                size={20}
                iconColor={COLORS.danger}
                onPress={() => confirmarExclusao(item)}
                accessibilityLabel={`Excluir ${item.nome}`}
              />
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  lista: { padding: SPACING.lg },
  botaoNovo: { marginBottom: SPACING.md, borderRadius: RADIUS.pill },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitulo: { ...FONT.h3, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textMuted, marginTop: 4 },
  card: { marginBottom: SPACING.md, ...CARD, borderRadius: RADIUS.lg },
  cardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(COLORS.primary, '18'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardInfo: { flex: 1 },
  cardNome: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  cardFuncao: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
});
