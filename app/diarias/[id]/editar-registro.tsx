import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import KeyboardAwareScrollView from '../../../components/KeyboardAwareScrollView';
import { TextInput, Button, Text, ActivityIndicator } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRegistros, updateRegistro } from '../../../storage/storageDiarias';
import { parsearMoeda, formatarMoedaInput, formatarMoeda } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../../../constants/theme';

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

export default function EditarRegistro() {
  const { registroId } = useLocalSearchParams<{ registroId: string }>();
  const router = useRouter();
  const [dataDia, setDataDia] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [valorAdicional, setValorAdicional] = useState('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const registros = await getRegistros();
      const r = registros.find((item) => item.id === registroId);
      if (r) {
        setDataDia(new Date(r.data));
        setObservacao(r.observacao ?? '');
        setValorAdicional(r.valorAdicional ? formatarMoeda(r.valorAdicional) : '');
      }
      setCarregando(false);
    })();
  }, [registroId]);

  const aoMudarData = (_event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarCalendario(Platform.OS === 'ios');
    if (dataSelecionada) {
      setDataDia(dataSelecionada);
    }
  };

  const salvar = async () => {
    await updateRegistro(registroId!, {
      data: dataDia.toISOString(),
      observacao: observacao.trim() || undefined,
      valorAdicional: valorAdicional ? parsearMoeda(valorAdicional) : 0,
    });
    router.back();
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titulo}>Editar registro</Text>

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

        <Button mode="contained" onPress={salvar} style={styles.button} buttonColor={COLORS.primary} contentStyle={{ paddingVertical: 6 }} accessibilityLabel="Salvar alterações">
          Salvar
        </Button>

        <Button mode="text" onPress={() => router.back()} style={styles.botaoCancelar} textColor={COLORS.textSecondary} accessibilityLabel="Cancelar">
          Cancelar
        </Button>
      </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  keyboard: { flex: 1 },
  container: { flexGrow: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  titulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  input: { marginBottom: 2 },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
