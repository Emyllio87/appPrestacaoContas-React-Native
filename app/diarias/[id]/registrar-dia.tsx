import { useState } from 'react';
import { StyleSheet, TouchableOpacity, Platform } from 'react-native';
import KeyboardAwareScrollView from '../../../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addRegistro } from '../../../storage/storageDiarias';
import { parsearMoeda, formatarMoedaInput } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../../../constants/theme';

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

export default function RegistrarDia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [dataDia, setDataDia] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [valorAdicional, setValorAdicional] = useState('');
  const [erro, setErro] = useState('');

  const aoMudarData = (_event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarCalendario(Platform.OS === 'ios');
    if (dataSelecionada) {
      setDataDia(dataSelecionada);
    }
  };

  const salvar = async () => {
    await addRegistro({
      funcionarioId: id,
      data: dataDia.toISOString(),
      observacao: observacao.trim() || undefined,
      valorAdicional: valorAdicional ? parsearMoeda(valorAdicional) : 0,
    });
    router.back();
  };

  return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titulo}>Registrar dia trabalhado</Text>

        <TouchableOpacity
          onPress={() => setMostrarCalendario(true)}
          accessibilityRole="button"
          accessibilityLabel="Selecionar data"
        >
          <TextInput
            label="Data"
            mode="outlined"
            value={formatarData(dataDia)}
            editable={false}
            style={styles.input}
            right={<TextInput.Icon icon="calendar" />}
          />
        </TouchableOpacity>
        {mostrarCalendario && (
          <DateTimePicker
            value={dataDia}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={aoMudarData}
            maximumDate={new Date()}
            locale="pt-BR"
          />
        )}

        <TextInput
          label="Valor adicional (opcional)"
          mode="outlined"
          value={valorAdicional}
          onChangeText={(t) => setValorAdicional(formatarMoedaInput(t))}
          keyboardType="numeric"
          style={styles.input}
          left={<TextInput.Affix text="R$" />}
          placeholder="0,00"
        />

        <TextInput
          label="Observação (opcional)"
          mode="outlined"
          value={observacao}
          onChangeText={setObservacao}
          style={styles.input}
          placeholder="Ex: Dia de campo"
        />

        <HelperText type="error" visible={!!erro}>{erro}</HelperText>

        <Button mode="contained" onPress={salvar} style={styles.button} buttonColor={COLORS.primary} contentStyle={{ paddingVertical: 6 }} accessibilityLabel="Registrar dia">
          Registrar
        </Button>

        <Button mode="text" onPress={() => router.back()} style={styles.botaoCancelar} textColor={COLORS.textSecondary} accessibilityLabel="Cancelar">
          Cancelar
        </Button>
      </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flexGrow: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  titulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  input: { marginBottom: 2 },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
