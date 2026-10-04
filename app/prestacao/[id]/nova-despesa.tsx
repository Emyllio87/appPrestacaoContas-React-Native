import { useState, useCallback } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import KeyboardAwareScrollView from '../../../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text, Menu } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { addDespesa, getCategorias } from '../../../storage/storage';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput } from '../../../utils/formatacao';
import { Categoria } from '../../../types';
import { COLORS, SPACING, RADIUS, FONT } from '../../../constants/theme';

const schema = z.object({
  descricao: z.string().min(2, 'Informe uma descrição'),
  categoriaId: z.string().min(1, 'Selecione uma categoria'),
  valor: z.string().min(1, 'Informe o valor').refine(valorMoedaValido, 'Valor inválido'),
});

type FormData = z.infer<typeof schema>;

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

export default function NovaDespesa() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const [cupomUri, setCupomUri] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState('');
  const [dataDespesa, setDataDespesa] = useState(new Date());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);

  useFocusEffect(useCallback(() => { getCategorias().then(setCategorias); }, []));

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { descricao: '', categoriaId: '', valor: '' },
  });

  const categoriaSelecionada = watch('categoriaId');
  const nomeCategoriaSelecionada =
    categorias.find((c) => c.id === categoriaSelecionada)?.nome ?? '';

  const aoMudarData = (_event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarCalendario(Platform.OS === 'ios');
    if (dataSelecionada) {
      setDataDespesa(dataSelecionada);
    }
  };

  const tirarFoto = async () => {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      setErroImagem('Permissão de câmera negada');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
    if (!resultado.canceled) {
      setCupomUri(resultado.assets[0].uri);
      setErroImagem('');
    }
  };

  const escolherDaGaleria = async () => {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      setErroImagem('Permissão de galeria negada');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultado.canceled) {
      setCupomUri(resultado.assets[0].uri);
      setErroImagem('');
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!cupomUri) {
      setErroImagem('Anexe uma foto do cupom');
      return;
    }
    await addDespesa({
      prestacaoId: id,
      descricao: data.descricao,
      categoriaId: data.categoriaId,
      valor: parsearMoeda(data.valor),
      cupomUri,
      data: dataDespesa.toISOString(),
    });
    router.back();
  };

  return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
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
              placeholder="Ex: Almoço com cliente"
              accessibilityLabel="Descrição da despesa"
            />
          )}
        />
        <HelperText type="error" visible={!!errors.descricao}>
          {errors.descricao?.message}
        </HelperText>

        <Menu
          visible={menuAberto}
          onDismiss={() => setMenuAberto(false)}
          anchor={
            <TouchableOpacity
              onPress={() => setMenuAberto(true)}
              accessibilityRole="button"
              accessibilityLabel="Selecionar categoria da despesa"
            >
              <TextInput
                label="Categoria"
                mode="outlined"
                value={nomeCategoriaSelecionada}
                placeholder="Selecionar categoria"
                editable={false}
                style={styles.input}
                right={<TextInput.Icon icon="chevron-down" />}
              />
            </TouchableOpacity>
          }
        >
          {categorias.map((cat) => (
            <Menu.Item
              key={cat.id}
              title={cat.nome}
              onPress={() => {
                setValue('categoriaId', cat.id);
                setMenuAberto(false);
              }}
            />
          ))}
          <Menu.Item
            title="+ Gerenciar categorias"
            onPress={() => {
              setMenuAberto(false);
              router.push('/categorias');
            }}
          />
        </Menu>
        <HelperText type="error" visible={!!errors.categoriaId}>
          {errors.categoriaId?.message}
        </HelperText>

        <Controller
          control={control}
          name="valor"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Valor"
              mode="outlined"
              value={value}
              onChangeText={(texto) => onChange(formatarMoedaInput(texto))}
              keyboardType="numeric"
              style={styles.input}
              left={<TextInput.Affix text="R$" />}
              placeholder="0,00"
              accessibilityLabel="Valor da despesa em reais"
            />
          )}
        />
        <HelperText type="error" visible={!!errors.valor}>
          {errors.valor?.message}
        </HelperText>

        <TouchableOpacity
          onPress={() => setMostrarCalendario(true)}
          accessibilityRole="button"
          accessibilityLabel="Selecionar data da despesa"
        >
          <TextInput
            label="Data"
            mode="outlined"
            value={formatarData(dataDespesa)}
            editable={false}
            style={styles.input}
            right={<TextInput.Icon icon="calendar" />}
          />
        </TouchableOpacity>
        {mostrarCalendario && (
          <DateTimePicker
            value={dataDespesa}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={aoMudarData}
            maximumDate={new Date()}
            locale="pt-BR"
          />
        )}

        <Text style={styles.secao}>Cupom fiscal</Text>
        {cupomUri ? (
          <TouchableOpacity
            onPress={tirarFoto}
            accessibilityRole="imagebutton"
            accessibilityLabel="Foto do cupom anexada. Toque para tirar outra foto"
          >
            <Image source={{ uri: cupomUri }} style={styles.preview} />
          </TouchableOpacity>
        ) : (
          <View style={styles.botoesImagem}>
            <Button mode="outlined" icon="camera" onPress={tirarFoto} style={styles.botaoMeio} contentStyle={{ paddingVertical: 4 }} accessibilityLabel="Tirar foto do cupom com a câmera">
              Câmera
            </Button>
            <Button mode="outlined" icon="image" onPress={escolherDaGaleria} style={styles.botaoMeio} contentStyle={{ paddingVertical: 4 }} accessibilityLabel="Escolher foto do cupom da galeria">
              Galeria
            </Button>
          </View>
        )}
        <HelperText type="error" visible={!!erroImagem}>
          {erroImagem}
        </HelperText>

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.button}
          buttonColor={COLORS.primary}
          contentStyle={{ paddingVertical: 6 }}
          accessibilityLabel="Salvar despesa"
        >
          Salvar despesa
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
  secao: { ...FONT.bodyStrong, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  input: { marginBottom: 2 },
  botoesImagem: { flexDirection: 'row', marginTop: SPACING.xs, gap: SPACING.sm },
  botaoMeio: { flex: 1 },
  preview: { width: '100%', height: 200, borderRadius: RADIUS.md, marginTop: SPACING.xs },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
