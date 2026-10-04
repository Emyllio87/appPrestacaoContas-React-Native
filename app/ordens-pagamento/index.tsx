import { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, CARD, withAlpha, FONT } from '../../constants/theme';

export default function OrdensPagamento() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setCarregando(true);
      setTimeout(() => setCarregando(false), 300);
    }, [])
  );

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator animating color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card
        style={styles.card}
        onPress={() => router.push('/ordens-pagamento/nova-ordem')}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.cardTexto}>
            <Text style={styles.cardTitulo}>Ordem de Pagamento</Text>
            <Text style={styles.cardDescricao}>Criar nova ordem de pagamento</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
        </Card.Content>
      </Card>

      <Card
        style={styles.card}
        onPress={() => router.push('/ordens-pagamento/historico')}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="history" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.cardTexto}>
            <Text style={styles.cardTitulo}>Histórico</Text>
            <Text style={styles.cardDescricao}>Visualizar ordens anteriores</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.lg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  card: { marginBottom: SPACING.md, ...CARD, borderRadius: RADIUS.lg },
  cardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: withAlpha(COLORS.primary, '10'),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardTexto: { flex: 1 },
  cardTitulo: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  cardDescricao: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
});
