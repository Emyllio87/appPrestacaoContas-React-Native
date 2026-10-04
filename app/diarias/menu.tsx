import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, CARD, withAlpha, FONT } from '../../constants/theme';

const opcoes = [
  {
    titulo: 'Funcionários',
    descricao: 'Cadastro e controle de diárias',
    icon: 'account-group-outline' as const,
    rota: '/diarias',
    cor: COLORS.primary,
  },
  {
    titulo: 'Pagamentos',
    descricao: 'Fechamentos e relatórios',
    icon: 'cash-check' as const,
    rota: '/diarias/pagamentos',
    cor: COLORS.primary,
  },
];

export default function MenuDiarias() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {opcoes.map((opcao) => (
        <Card
          key={opcao.rota}
          style={styles.card}
          onPress={() => router.push(opcao.rota)}
          accessibilityLabel={`Abrir ${opcao.titulo}`}
        >
          <Card.Content style={styles.cardContent}>
            <View style={[styles.iconContainer, { backgroundColor: withAlpha(opcao.cor, '18') }]}>
              <MaterialCommunityIcons name={opcao.icon} size={28} color={opcao.cor} />
            </View>
            <View style={styles.cardTexto}>
              <Text style={styles.cardTitulo}>{opcao.titulo}</Text>
              <Text style={styles.cardDescricao}>{opcao.descricao}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
          </Card.Content>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.lg },
  card: { marginBottom: SPACING.md, ...CARD, borderRadius: RADIUS.lg },
  cardContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  cardTexto: { flex: 1 },
  cardTitulo: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  cardDescricao: { ...FONT.caption, color: COLORS.textSecondary, marginTop: 4 },
});
