import { useState, useCallback } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import KeyboardAwareScrollView from '../../../components/KeyboardAwareScrollView';
import { TextInput, Button, HelperText, Text, Menu, ActivityIndicator } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { getOrdensPagamento, updateOrdemPagamento } from '../../../storage/storageOrdens';
import { TipoChavePix } from '../../../types';
import { parsearMoeda, valorMoedaValido, formatarMoedaInput } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, FONT } from '../../../constants/theme';

const schema = z.object({
  fornecedor: z.string().min(2, 'Informe o nome do fornecedor'),
  pixInfo: z.string().min(3, 'Informe a chave PIX'),
  valor: z.string().min(1, 'Informe o valor').refine(valorMoedaValido, 'Valor inválido'),
  assunto: z.string().min(2, 'Informe o assunto do pagamento'),
});

type FormData = z.infer<typeof schema>;

const CHAVES_PIX: { value: TipoChavePix; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
];

export default function EditarOrdem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [imagemUri, setImagemUri] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState<TipoChavePix>('cpf');
  const [menuAberto, setMenuAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const ordens = await getOrdensPagamento();
      const o = ordens.find((item) => item.id === id);
      if (o) {
        setValue('fornecedor', o.fornecedor);
        setValue('pixInfo', o.pixInfo);
        setValue('valor', formatarMoedaInput(String(Math.round(o.valor * 100))));
        setValue('assunto', o.assunto);
        setTipoChavePix(o.tipoChavePix);
        setImagemUri(o.imagemUri || null);
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
    defaultValues: { fornecedor: '', pixInfo: '', valor: '', assunto: '' },
  });

  const tirarFoto = async () => {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissao.granted) {
      setErroImagem('Permissão de câmera negada');
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
    if (!resultado.canceled) {
      setImagemUri(resultado.assets[0].uri);
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
      setImagemUri(resultado.assets[0].uri);
      setErroImagem('');
    }
  };

  const removerImagem = () => {
    Alert.alert('Remover imagem', 'Deseja remover a imagem anexada?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => setImagemUri(null) },
    ]);
  };

  const onSubmit = async (data: FormData) => {
    await updateOrdemPagamento(id, {
      fornecedor: data.fornecedor,
      tipoChavePix,
      pixInfo: data.pixInfo,
      valor: parsearMoeda(data.valor),
      assunto: data.assunto,
      imagemUri: imagemUri ?? '',
    });
    router.back();
  };

  const labelTipoChave = CHAVES_PIX.find((c) => c.value === tipoChavePix)?.label ?? '';

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.warning} />
      </View>
    );
  }

  return (
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titulo}>Editar ordem de pagamento</Text>

        <Controller
          control={control}
          name="fornecedor"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Fornecedor" mode="outlined" value={value} onChangeText={onChange} style={styles.input} accessibilityLabel="Nome do fornecedor" />
          )}
        />
        <HelperText type="error" visible={!!errors.fornecedor} style={{ marginTop: -4, marginBottom: 2 }}>{errors.fornecedor?.message}</HelperText>

        <Menu
          visible={menuAberto}
          onDismiss={() => setMenuAberto(false)}
          anchor={
            <TouchableOpacity onPress={() => setMenuAberto(true)} accessibilityRole="button" accessibilityLabel="Selecionar tipo de chave PIX">
              <TextInput
                label="Tipo de chave PIX"
                mode="outlined"
                value={labelTipoChave}
                placeholder="Selecionar tipo"
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
            <TextInput label="Chave PIX" mode="outlined" value={value} onChangeText={onChange} style={styles.input} accessibilityLabel="Chave PIX do fornecedor" />
          )}
        />
        <HelperText type="error" visible={!!errors.pixInfo} style={{ marginTop: -4, marginBottom: 2 }}>{errors.pixInfo?.message}</HelperText>

        <Controller
          control={control}
          name="valor"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Valor" mode="outlined" value={value} onChangeText={(t) => onChange(formatarMoedaInput(t))} keyboardType="numeric" style={styles.input} left={<TextInput.Affix text="R$" />} accessibilityLabel="Valor do pagamento" />
          )}
        />
        <HelperText type="error" visible={!!errors.valor} style={{ marginTop: -4, marginBottom: 2 }}>{errors.valor?.message}</HelperText>

        <Controller
          control={control}
          name="assunto"
          render={({ field: { onChange, value } }) => (
            <TextInput label="Assunto do pagamento" mode="outlined" value={value} onChangeText={onChange} style={styles.input} accessibilityLabel="Assunto do pagamento" />
          )}
        />
        <HelperText type="error" visible={!!errors.assunto} style={{ marginTop: -4, marginBottom: 2 }}>{errors.assunto?.message}</HelperText>

        <Text style={styles.secao}>Imagem do pedido (opcional)</Text>
        {imagemUri ? (
          <View>
            <TouchableOpacity
              onPress={tirarFoto}
              accessibilityRole="imagebutton"
              accessibilityLabel="Imagem anexada. Toque para trocar"
            >
              <Image key={imagemUri} source={{ uri: imagemUri }} style={styles.preview} />
            </TouchableOpacity>
            <View style={styles.botoesImagem}>
              <Button mode="outlined" icon="camera" onPress={tirarFoto} style={styles.botaoMeio} accessibilityLabel="Trocar imagem">
                Trocar
              </Button>
              <Button mode="outlined" icon="delete" onPress={removerImagem} textColor={COLORS.danger} style={styles.botaoMeio} accessibilityLabel="Remover imagem">
                Remover
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.botoesImagem}>
            <Button mode="outlined" icon="camera" onPress={tirarFoto} style={styles.botaoMeio} accessibilityLabel="Tirar foto do pedido">
              Câmera
            </Button>
            <Button mode="outlined" icon="image" onPress={escolherDaGaleria} style={styles.botaoMeio} accessibilityLabel="Escolher foto do pedido da galeria">
              Galeria
            </Button>
          </View>
        )}
        <HelperText type="error" visible={!!erroImagem} style={{ marginTop: -4, marginBottom: 2 }}>{erroImagem}</HelperText>

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
  secao: { ...FONT.bodyStrong, color: COLORS.textSecondary, marginTop: SPACING.sm, marginBottom: SPACING.xs },
  input: { marginBottom: 2 },
  botoesImagem: { flexDirection: 'row', marginTop: SPACING.xs, gap: SPACING.sm },
  botaoMeio: { flex: 1 },
  preview: { width: '100%', height: 200, borderRadius: RADIUS.md, marginTop: SPACING.xs },
  button: { marginTop: SPACING.lg, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.sm },
});
