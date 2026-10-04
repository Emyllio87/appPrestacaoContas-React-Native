import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { TextInput, Button, List, IconButton, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getCategorias, addCategoria, deleteCategoria } from '../storage/storage';
import { Categoria } from '../types';
import { COLORS, SPACING, RADIUS, CARD, FONT } from '../constants/theme';

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(() => { getCategorias().then(setCategorias); }, []);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const aoPuxarParaAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const adicionar = async () => {
    if (nome.trim().length < 2) {
      setErro('Digite um nome válido');
      return;
    }
    await addCategoria(nome.trim());
    setNome('');
    setErro('');
    carregar();
  };

  const remover = (id: string) => {
    Alert.alert(
      'Excluir categoria',
      'Despesas já lançadas com esta categoria não serão afetadas. Confirmar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await deleteCategoria(id);
            carregar();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <TextInput
          label="Nova categoria"
          mode="outlined"
          value={nome}
          onChangeText={setNome}
          style={styles.input}
          placeholder="Ex: Alimentação"
          accessibilityLabel="Nome da nova categoria"
        />
        <Button mode="contained" onPress={adicionar} buttonColor={COLORS.primary} style={styles.botaoAdicionar} accessibilityLabel="Adicionar categoria">
          Adicionar
        </Button>
      </View>
      {!!erro && (
        <Text style={styles.erroTexto}>{erro}</Text>
      )}

      <FlatList
        data={categorias}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="tag-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitulo}>Nenhuma categoria</Text>
            <Text style={styles.emptySubtitulo}>Adicione categorias para classificar despesas.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <List.Item
            title={item.nome}
            titleStyle={styles.itemTitulo}
            style={styles.item}
            right={() => (
              <IconButton
                icon="delete-outline"
                size={20}
                iconColor={COLORS.danger}
                onPress={() => remover(item.id)}
                accessibilityLabel={`Excluir categoria ${item.nome}`}
              />
            )}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  form: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.sm },
  input: { flex: 1 },
  botaoAdicionar: { borderRadius: RADIUS.pill },
  erroTexto: { color: COLORS.danger, ...FONT.caption, marginLeft: SPACING.lg, marginBottom: SPACING.sm },
  lista: { padding: SPACING.md },
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyTitulo: { ...FONT.h3, color: COLORS.textSecondary, marginTop: SPACING.sm },
  emptySubtitulo: { ...FONT.caption, color: COLORS.textMuted, marginTop: 4 },
  item: { marginBottom: SPACING.xs, ...CARD },
  itemTitulo: { ...FONT.bodyStrong, color: COLORS.textPrimary },
});
