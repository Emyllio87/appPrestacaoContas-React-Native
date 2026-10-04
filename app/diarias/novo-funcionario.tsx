import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import KeyboardAwareScrollView from '../../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text, Menu } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'expo-router';
import { addFuncionario } from '../../storage/storageDiarias';
import { TipoChavePix } from '../../types';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput, formatarTelefone } from '../../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../../constants/theme';

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

export default function NovoFuncionario() {
  const router = useRouter();
  const [tipoChavePix, setTipoChavePix] = useState<TipoChavePix>('cpf');
  const [menuAberto, setMenuAberto] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', funcao: '', valorDiaria: '', telefone: '', pixInfo: '' },
  });

  const labelTipoChave = CHAVES_PIX.find((c) => c.value === tipoChavePix)?.label ?? '';

  const onSubmit = async (data: FormData) => {
    await addFuncionario({
      nome: data.nome,
      funcao: data.funcao,
      valorDiaria: parsearMoeda(data.valorDiaria),
      telefone: data.telefone,
      tipoChavePix,
      pixInfo: data.pixInfo,
    });
    router.back();
  };

  return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titulo}>Novo funcionário</Text>

        <Controller
          control={control}
          name="nome"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Nome" mode="outlined" value={value} onChangeText={onChange} style={styles.input} accessibilityLabel="Nome do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.nome} style={styles.helper}>{errors.nome?.message}</HelperText>

        <Controller
          control={control}
          name="funcao"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Função" mode="outlined" value={value} onChangeText={onChange} style={styles.input} placeholder="Ex: Motorista, Auxiliar" accessibilityLabel="Função do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.funcao} style={styles.helper}>{errors.funcao?.message}</HelperText>

        <Controller
          control={control}
          name="valorDiaria"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Valor da diária" mode="outlined" value={value} onChangeText={(t) => onChange(formatarMoedaInput(t))} keyboardType="numeric" style={styles.input} left={<TextInput.Affix text="R$" />} placeholder="0,00" accessibilityLabel="Valor da diária" />
          )}
        />
        <HelperText type="error" visible={!!errors.valorDiaria} style={styles.helper}>{errors.valorDiaria?.message}</HelperText>

        <Controller
          control={control}
          name="telefone"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Telefone" mode="outlined" value={value} onChangeText={(t) => onChange(formatarTelefone(t))} style={styles.input} keyboardType="phone-pad" placeholder="(00) 00000-0000" accessibilityLabel="Telefone do funcionário" />
          )}
        />
        <HelperText type="error" visible={!!errors.telefone} style={styles.helper}>{errors.telefone?.message}</HelperText>

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
        <HelperText type="error" visible={!!errors.pixInfo} style={styles.helper}>{errors.pixInfo?.message}</HelperText>

        <Button mode="contained" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.button} buttonColor={COLORS.primary} contentStyle={{ paddingVertical: 6 }} accessibilityLabel="Salvar funcionário">
          Salvar
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
  titulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.lg },
  secao: { ...FONT.bodyStrong, color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.md },
  input: { marginBottom: 2 },
  helper: { marginTop: -4, marginBottom: SPACING.xs },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
