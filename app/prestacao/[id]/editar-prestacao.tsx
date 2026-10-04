import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import KeyboardAwareScrollView from '../../../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text, ActivityIndicator } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getPrestacoes, updatePrestacao, getDespesasPorPrestacao } from '../../../storage/storage';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../../../constants/theme';

const schema = z.object({
  descricao: z.string().min(2, 'Informe uma descrição'),
  valorRecebido: z
    .string()
    .optional()
    .refine((val) => !val || valorMoedaValido(val), 'Valor inválido'),
});

type FormData = z.infer<typeof schema>;

export default function EditarPrestacao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const prestacoes = await getPrestacoes();
      const p = prestacoes.find((item) => item.id === id);
      if (p) {
        setValue('descricao', p.descricao);
        if (p.valorRecebido > 0) {
          setValue('valorRecebido', formatarMoedaInput(String(Math.round(p.valorRecebido * 100))));
        }
      }
      setCarregando(false);
    })();
  }, [id]));

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { descricao: '', valorRecebido: '' },
  });

  const onSubmit = async (data: FormData) => {
    const novoValor = data.valorRecebido ? parsearMoeda(data.valorRecebido) : 0;
    await updatePrestacao(id, {
      descricao: data.descricao,
      valorRecebido: novoValor,
    });

    const despesas = await getDespesasPorPrestacao(id);
    const totalGasto = despesas.reduce((acc, d) => acc + d.valor, 0);
    const saldo = novoValor - totalGasto;
    const { fecharPrestacao } = await import('../../../storage/storage');
    await fecharPrestacao(id, saldo);

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
        <Text style={styles.titulo}>Editar prestação</Text>

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

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.button}
          buttonColor={COLORS.primary}
          contentStyle={{ paddingVertical: 6 }}
          accessibilityLabel="Salvar alterações"
        >
          Salvar
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  keyboard: { flex: 1 },
  container: { flexGrow: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  titulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  input: { marginBottom: 2 },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
