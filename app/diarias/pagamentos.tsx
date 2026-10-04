import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, CARD, withAlpha, FONT } from '../../constants/theme';

export default function MenuPagamentos() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Card
        style={styles.card}
        onPress={() => router.push('/diarias/pagamentos/lista')}
        accessibilityLabel="Realizar pagamentos"
      >
        <Card.Content style={styles.cardContent}>
          <View style={[styles.iconContainer, { backgroundColor: withAlpha(COLORS.primary, '18') }]}>
            <MaterialCommunityIcons name="cash-check" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.cardTexto}>
            <Text variant="titleMedium" style={styles.cardTitulo}>Realizar Pagamentos</Text>
            <Text style={styles.cardDescricao}>Visualizar e gerenciar fechamentos de períodos</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.lg },
  card: { marginBottom: SPACING.md, ...CARD, borderRadius: RADIUS.lg },
  cardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md },
  iconContainer: { width: 44, height: 44, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  cardTexto: { flex: 1 },
  cardTitulo: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  cardDescricao: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
});
