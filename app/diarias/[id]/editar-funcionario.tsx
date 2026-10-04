import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import KeyboardAwareScrollView from '../../../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text, Menu, ActivityIndicator } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getFuncionarios, updateFuncionario } from '../../../storage/storageDiarias';
import { TipoChavePix } from '../../../types';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput, formatarMoeda, formatarTelefone } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../../../constants/theme';

const schema = z.object({
  nome: z.string().min(2, 'Informe o nome'),
  funcao: z.string().min(2, 'Informe a função'),
  valorDiaria: z.string().min(1, 'Informe o valor da diária').refine(valorMoedaValido, 'Valor inválido'),
  telefone: z.string().min(8, 'Informe o telefone'),
  pixInfo: z.string().min(3, 'Informe a chave PIX'),
});

type FormData = z.infer<typeof schema>;

const CHAVES_PIX: { value: TipoChavePix; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
];

export default function EditarFuncionario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [tipoChavePix, setTipoChavePix] = useState<TipoChavePix>('cpf');
  const [menuAberto, setMenuAberto] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    (async () => {
      const funcionarios = await getFuncionarios();
      const f = funcionarios.find((item) => item.id === id);
      if (f) {
        setTipoChavePix(f.tipoChavePix);
        reset({
          nome: f.nome,
          funcao: f.funcao,
          valorDiaria: formatarMoeda(f.valorDiaria),
          telefone: f.telefone,
          pixInfo: f.pixInfo,
        });
      }
      setCarregando(false);
    })();
  }, [id, reset]);

  const labelTipoChave = CHAVES_PIX.find((c) => c.value === tipoChavePix)?.label ?? '';

  const onSubmit = async (data: FormData) => {
    await updateFuncionario(id!, {
      nome: data.nome,
      funcao: data.funcao,
      valorDiaria: parsearMoeda(data.valorDiaria),
      telefone: data.telefone,
      tipoChavePix,
      pixInfo: data.pixInfo,
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
        <Text style={styles.titulo}>Editar funcionário</Text>

        <Controller
          control={control}
          name="nome"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Nome" mode="outlined" value={value} onChangeText={onChange} style={styles.input} accessibilityLabel="Nome do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.nome} style={{ marginTop: -4, marginBottom: 2 }}>{errors.nome?.message}</HelperText>

        <Controller
          control={control}
          name="funcao"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Função" mode="outlined" value={value} onChangeText={onChange} style={styles.input} placeholder="Ex: Motorista, Auxiliar" accessibilityLabel="Função do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.funcao} style={{ marginTop: -4, marginBottom: 2 }}>{errors.funcao?.message}</HelperText>

        <Controller
          control={control}
          name="valorDiaria"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Valor da diária" mode="outlined" value={value} onChangeText={(t) => onChange(formatarMoedaInput(t))} keyboardType="numeric" style={styles.input} left={<TextInput.Affix text="R$" />} placeholder="0,00" accessibilityLabel="Valor da diária" />
          )}
        />
        <HelperText type="error" visible={!!errors.valorDiaria} style={{ marginTop: -4, marginBottom: 2 }}>{errors.valorDiaria?.message}</HelperText>

        <Controller
          control={control}
          name="telefone"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Telefone" mode="outlined" value={value} onChangeText={(t) => onChange(formatarTelefone(t))} style={styles.input} keyboardType="phone-pad" placeholder="(00) 00000-0000" accessibilityLabel="Telefone do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.telefone} style={{ marginTop: -4, marginBottom: 2 }}>{errors.telefone?.message}</HelperText>

        <Text style={styles.secao}>Tipo chave PIX</Text>
        <Menu
          visible={menuAberto}
          onDismiss={() => setMenuAberto(false)}
          anchor={
            <TouchableOpacity onPress={() => setMenuAberto(true)}>
              <TextInput
                label="Tipo chave PIX"
                mode="outlined"
                value={labelTipoChave}
                editable={false}
                style={styles.input}
                right={<TextInput.Icon icon="chevron-down" />}
              />
            </TouchableOpacity>
          }
        >
          {CHAVES_PIX.map((c) => (
            <Menu.Item
              key={c.value}
              title={c.label}
              onPress={() => {
                setTipoChavePix(c.value);
                setMenuAberto(false);
              }}
            />
          ))}
        </Menu>

        <Controller
          control={control}
          name="pixInfo"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Chave PIX" mode="outlined" value={value} onChangeText={onChange} style={styles.input} placeholder="Digite a chave PIX" accessibilityLabel="Chave PIX do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.pixInfo} style={{ marginTop: -4, marginBottom: 2 }}>{errors.pixInfo?.message}</HelperText>

        <Button mode="contained" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.button} buttonColor={COLORS.primary} contentStyle={{ paddingVertical: 6 }} accessibilityLabel="Salvar alterações">
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
  secao: { ...FONT.bodyStrong, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  input: { marginBottom: 2 },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
