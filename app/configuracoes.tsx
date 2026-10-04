import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { exportarDados, importarDados } from '../services/backupService';
import { COLORS, SPACING, RADIUS, FONT, CARD } from '../constants/theme';

export default function Configuracoes() {
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);

  const handleExportar = async () => {
    setExportando(true);
    try {
      await exportarDados();
    } catch {
      Alert.alert('Erro', 'Não foi possível exportar os dados');
    } finally {
      setExportando(false);
    }
  };

  const handleImportar = async () => {
    Alert.alert(
      'Importar dados',
      'Os dados do backup serão adicionados aos dados existentes. Duplicatas serão ignoradas. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async () => {
            setImportando(true);
            try {
              const resultado = await importarDados();
              Alert.alert(resultado.sucesso ? 'Sucesso' : 'Aviso', resultado.mensagem);
            } catch {
              Alert.alert('Erro', 'Não foi possível importar os dados');
            } finally {
              setImportando(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="export" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitulo}>Exportar Dados</Text>
          </View>
          <Text style={styles.cardDescricao}>
            Salva um arquivo JSON com todos os dados do aplicativo.
          </Text>
          <Button
            mode="contained"
            icon="export"
            buttonColor={COLORS.primary}
            onPress={handleExportar}
            loading={exportando}
            style={styles.botao}
            accessibilityLabel="Exportar dados para arquivo JSON"
          >
            Exportar
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="import" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitulo}>Importar Dados</Text>
          </View>
          <Text style={styles.cardDescricao}>
            Restaura dados de um backup anterior.
          </Text>
          <Button
            mode="contained"
            icon="import"
            buttonColor={COLORS.primary}
            onPress={handleImportar}
            loading={importando}
            style={styles.botao}
            accessibilityLabel="Importar dados de arquivo JSON"
          >
            Importar
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.ajudaContainer}>
        <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.textMuted} />
        <Text style={styles.ajuda}>
          O arquivo pode ser compartilhado por WhatsApp, email, Google Drive ou qualquer outro app.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md, backgroundColor: COLORS.background },
  card: { ...CARD, marginBottom: SPACING.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  cardTitulo: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  cardDescricao: { ...FONT.caption, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  botao: { borderRadius: RADIUS.pill },
  ajudaContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, marginTop: SPACING.md },
  ajuda: { flex: 1, color: COLORS.textMuted, ...FONT.small },
});
