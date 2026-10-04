import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, CARD, MODULE_COLORS, withAlpha, FONT } from '../constants/theme';

const modulos = [
  { titulo: 'Prestação de Contas', icon: 'file-document-outline' as const, rota: '/prestacoes', chave: 'prestacoes' as keyof typeof MODULE_COLORS },
  { titulo: 'Diárias', icon: 'calendar-range-outline' as const, rota: '/diarias/menu', chave: 'diarias' as keyof typeof MODULE_COLORS },
  { titulo: 'Ordens de Pagamento', icon: 'currency-usd' as const, rota: '/ordens-pagamento', chave: 'ordens' as keyof typeof MODULE_COLORS },
  { titulo: 'Orçamentos', icon: 'cart-outline' as const, rota: '/pedidos', chave: 'pedidos' as keyof typeof MODULE_COLORS },
];

export default function Home() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitulo}>SISTEMA DE GESTÃO</Text>

      <View style={styles.grid}>
        {modulos.map((modulo) => {
          const cor = MODULE_COLORS[modulo.chave];
          return (
            <Card
              key={modulo.rota}
              style={styles.card}
              onPress={() => router.push(modulo.rota)}
              accessibilityLabel={`Abrir ${modulo.titulo}`}
            >
              <Card.Content style={styles.cardContent}>
                <View style={[styles.iconContainer, { backgroundColor: withAlpha(cor, '18') }]}>
                  <MaterialCommunityIcons name={modulo.icon} size={28} color={cor} />
                </View>
                <Text style={styles.cardTitulo} numberOfLines={2}>
                  {modulo.titulo}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
              </Card.Content>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  headerTitulo: {
    ...FONT.captionStrong,
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: SPACING.xl,
    marginTop: SPACING.sm,
  },
  grid: {
    gap: SPACING.md,
  },
  card: {
    ...CARD,
    borderRadius: RADIUS.lg,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardTitulo: {
    flex: 1,
    ...FONT.bodyStrong,
    color: COLORS.textPrimary,
  },
});
