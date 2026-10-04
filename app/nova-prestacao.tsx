import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { addPrestacao } from '../storage/storage';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput } from '../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../constants/theme';

const schema = z.object({
  descricao: z.string().min(2, 'Informe uma descrição'),
  valorRecebido: z
    .string()
    .optional()
    .refine((val) => !val || valorMoedaValido(val), 'Valor inválido'),
});

type FormData = z.infer<typeof schema>;

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

export default function NovaPrestacao() {
  const router = useRouter();
  const [dataCriacao, setDataCriacao] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { descricao: '', valorRecebido: '' },
  });

  const aoMudarData = (_event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarCalendario(Platform.OS === 'ios');
    if (dataSelecionada) {
      setDataCriacao(dataSelecionada);
    }
  };

  const onSubmit = async (data: FormData) => {
    await addPrestacao({
      descricao: data.descricao,
      valorRecebido: data.valorRecebido ? parsearMoeda(data.valorRecebido) : 0,
      data: dataCriacao.toISOString(),
    });
    router.back();
  };

  return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titulo}>Nova prestação</Text>

        <Controller
          control={control}
          name="descricao"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Descrição"
              mode="outlined"
              value={value}
              onChangeText={onChange}
              style={styles.input}
              placeholder="Ex: Viagem SP"
              accessibilityLabel="Descrição da prestação de contas"
            />
          )}
        />
        <HelperText type="error" visible={!!errors.descricao}>
          {errors.descricao?.message}
        </HelperText>

        <Controller
          control={control}
          name="valorRecebido"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Valor recebido (opcional)"
              mode="outlined"
              value={value}
              onChangeText={(texto) => onChange(formatarMoedaInput(texto))}
              keyboardType="numeric"
              style={styles.input}
              placeholder="0,00"
              left={<TextInput.Affix text="R$" />}
              accessibilityLabel="Valor recebido em reais"
            />
          )}
        />
        <HelperText type="error" visible={!!errors.valorRecebido}>
          {errors.valorRecebido?.message}
        </HelperText>

        <TouchableOpacity
          onPress={() => setMostrarCalendario(true)}
          accessibilityRole="button"
          accessibilityLabel="Selecionar data de criação"
        >
          <TextInput
            label="Data de criação"
            mode="outlined"
            value={formatarData(dataCriacao)}
            editable={false}
            style={styles.input}
            right={<TextInput.Icon icon="calendar" />}
          />
        </TouchableOpacity>
        {mostrarCalendario && (
          <DateTimePicker
            value={dataCriacao}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={aoMudarData}
            maximumDate={new Date()}
            locale="pt-BR"
          />
        )}

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.button}
          buttonColor={COLORS.primary}
          contentStyle={{ paddingVertical: 6 }}
          accessibilityLabel="Criar prestação de contas"
        >
          Criar prestação
        </Button>

        <Button
          mode="text"
          onPress={() => router.back()}
          style={styles.botaoCancelar}
          textColor={COLORS.textSecondary}
          accessibilityLabel="Cancelar e voltar"
        >
          Cancelar
        </Button>
      </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  container: { flexGrow: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  titulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  input: { marginBottom: 2 },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
