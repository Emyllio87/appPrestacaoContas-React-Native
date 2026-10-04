import { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONT, CARD, withAlpha } from '../../constants/theme';
import { carregarPedidos, excluirPedido, salvarPedido } from '../../storage/storagePedidos';
import { PedidoCotacao, ItemCotacao } from '../../types';

export default function EditarPedido() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pedido, setPedido] = useState<PedidoCotacao | null>(null);
  const [itens, setItens] = useState<ItemCotacao[]>([]);

  const [assunto, setAssunto] = useState('');
  const [material, setMaterial] = useState('');
  const [unidade, setUnidade] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');

  const [editandoItem, setEditandoItem] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      const pedidos = await carregarPedidos();
      const encontrado = pedidos.find((p) => p.id === id);
      if (encontrado) {
        setPedido(encontrado);
        setItens(encontrado.itens);
        setAssunto(encontrado.assunto);
      }
    };
    carregar();
  }, [id]);

  const limparCampos = () => {
    setMaterial('');
    setUnidade('');
    setQuantidade('');
    setObservacao('');
    setEditandoItem(null);
  };

  const adicionarItem = () => {
    if (!material.trim() || !unidade.trim() || !quantidade.trim()) {
      Alert.alert('Atenção', 'Preencha material, unidade e quantidade.');
      return;
    }

    if (editandoItem) {
      setItens((prev) =>
        prev.map((item) =>
          item.id === editandoItem
            ? {
                ...item,
                material: material.trim(),
                unidade: unidade.trim(),
                quantidade: quantidade.trim(),
                observacao: observacao.trim(),
              }
            : item
        )
      );
    } else {
      const novoItem: ItemCotacao = {
        id: String(Date.now()),
        material: material.trim(),
        unidade: unidade.trim(),
        quantidade: quantidade.trim(),
        observacao: observacao.trim(),
      };
      setItens((prev) => [...prev, novoItem]);
    }
    limparCampos();
  };

  const editarItem = (item: ItemCotacao) => {
    setEditandoItem(item.id);
    setMaterial(item.material);
    setUnidade(item.unidade);
    setQuantidade(item.quantidade);
    setObservacao(item.observacao);
  };

  const removerItem = (idItem: string) => {
    setItens((prev) => prev.filter((item) => item.id !== idItem));
    if (editandoItem === idItem) {
      limparCampos();
    }
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

    if (!pedido) return;

    try {
      const pedidoAtualizado: PedidoCotacao = {
        ...pedido,
        assunto: assunto.trim(),
        itens,
      };
      await excluirPedido(pedido.id);
      await salvarPedido(pedidoAtualizado);
      Alert.alert('Sucesso', 'Pedido atualizado!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.');
    }
  };

  if (!pedido) {
    return (
      <View style={styles.center}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.content}>
      <Text variant="titleMedium" style={styles.titulo}>
        Editar Solicitação
      </Text>
      <Text style={styles.numero}>Número: {pedido.numero}</Text>

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

        <View style={styles.botoesForm}>
          {editandoItem && (
            <Button
              mode="outlined"
              onPress={limparCampos}
              style={styles.botaoCancelar}
              textColor={COLORS.textSecondary}
            >
              Cancelar
            </Button>
          )}
          <Button
            mode="contained"
            icon={editandoItem ? 'check' : 'plus'}
            buttonColor={COLORS.primary}
            onPress={adicionarItem}
            style={styles.botaoAdicionar}
            contentStyle={{ paddingVertical: 6 }}
          >
            {editandoItem ? 'Atualizar item' : 'Adicionar item'}
          </Button>
        </View>
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
            <View key={item.id} style={[styles.linhaItem, index % 2 === 1 && styles.linhaAlternada, editandoItem === item.id && styles.linhaEditando]}>
              <Text style={[styles.colValor, styles.colNum]}>{index + 1}</Text>
              <Text style={[styles.colValor, styles.colMaterial]}>{item.material}</Text>
              <Text style={[styles.colValor, styles.colUnidade]}>{item.unidade}</Text>
              <Text style={[styles.colValor, styles.colQtd]}>{item.quantidade}</Text>
              <Text style={[styles.colValor, styles.colObs]}>{item.observacao || '-'}</Text>
              <View style={styles.colAcao}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color={COLORS.primary}
                  onPress={() => editarItem(item)}
                />
                <MaterialCommunityIcons
                  name="close-circle"
                  size={16}
                  color={COLORS.danger}
                  onPress={() => removerItem(item.id)}
                />
              </View>
            </View>
          ))}

          <Button
            mode="contained"
            icon="content-save"
            buttonColor={COLORS.primary}
            onPress={salvar}
            style={styles.botaoSalvar}
            contentStyle={{ paddingVertical: 6 }}
          >
            Salvar Alterações
          </Button>
        </>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontWeight: '700', color: COLORS.textPrimary },
  numero: { ...FONT.bodyStrong, color: COLORS.primary, marginBottom: SPACING.md },
  formCard: {
    ...CARD,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  campo: { marginBottom: SPACING.sm },
  linha: { flexDirection: 'row', gap: SPACING.sm },
  campoPequeno: { flex: 1 },
  botoesForm: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  botaoCancelar: { flex: 1, borderRadius: RADIUS.pill, marginTop: SPACING.sm },
  botaoAdicionar: { flex: 2, borderRadius: RADIUS.pill },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: 2,
  },
  colHeader: {
    ...FONT.smallStrong,
    color: COLORS.surface,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  colNum: { width: 24, textAlign: 'center' },
  colMaterial: { flex: 2 },
  colUnidade: { flex: 1, textAlign: 'center' },
  colQtd: { flex: 1, textAlign: 'center' },
  colObs: { flex: 1.5 },
  colAcao: { width: 44, flexDirection: 'row', justifyContent: 'center', gap: 10 },
  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  linhaAlternada: { backgroundColor: COLORS.background },
  linhaEditando: { backgroundColor: withAlpha(COLORS.primary, '18'), borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  colValor: { ...FONT.caption, color: COLORS.textPrimary },
  botaoSalvar: { marginTop: SPACING.md, borderRadius: RADIUS.pill },
});
