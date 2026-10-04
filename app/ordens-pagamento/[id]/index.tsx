import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Image, ScrollView, RefreshControl, Alert } from 'react-native';
import { Text, Button, ActivityIndicator, Card } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getOrdensPagamento, deleteOrdemPagamento } from '../../../storage/storageOrdens';
import { OrdemPagamento, TipoChavePix } from '../../../types';
import { formatarMoeda } from '../../../utils/formatacao';
import { gerarPdfOrdem, abrirPdfOrdem, compartilharPdfOrdem } from '../../../services/pdfOrdemService';
import { COLORS, SPACING, RADIUS, SHADOW, FONT } from '../../../constants/theme';

export default function DetalheOrdem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ordem, setOrdem] = useState<OrdemPagamento | null>(null);
  const [uriPdf, setUriPdf] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const ordens = await getOrdensPagamento();
        const o = ordens.find((item) => item.id === id);
        if (!o) {
          setErro('Ordem não encontrada');
          return;
        }
        setOrdem(o);
      } catch {
        setErro('Não foi possível carregar a ordem');
      } finally {
        setCarregando(false);
      }
    })();
  }, [id]);

  const carregar = useCallback(async () => {
    const ordens = await getOrdensPagamento();
    const o = ordens.find((item) => item.id === id);
    setOrdem(o ?? null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const aoPuxarParaAtualizar = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const gerarEVerPdf = async () => {
    if (!ordem) return;
    setGerandoPdf(true);
    try {
      const uri = await gerarPdfOrdem(ordem);
      setUriPdf(uri);
      await abrirPdfOrdem(uri);
    } catch {
      setErro('Não foi possível gerar o PDF');
    } finally {
      setGerandoPdf(false);
    }
  };

  const compartilhar = async () => {
    if (!uriPdf) return;
    await compartilharPdfOrdem(uriPdf);
  };

  const labelTipoChave: Record<TipoChavePix, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    email: 'E-mail',
    telefone: 'Telefone',
    aleatoria: 'Chave aleatória',
  };

  if (carregando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.warning} />
      </View>
    );
  }

  if (erro || !ordem) {
    return (
      <View style={styles.center}>
        <Text style={styles.erroTexto}>{erro}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={aoPuxarParaAtualizar} colors={[COLORS.warning]} />
      }
    >
      <View style={styles.botoes}>
        <Button mode="outlined" icon="pencil" style={styles.botaoMeio} onPress={() => router.push(`/ordens-pagamento/${ordem.id}/editar-ordem`)} accessibilityLabel="Editar ordem de pagamento">
          Editar
        </Button>
        <Button mode="contained" icon="file-pdf-box" buttonColor={COLORS.primary} style={styles.botaoMeio} onPress={gerarEVerPdf} loading={gerandoPdf} accessibilityLabel="Gerar e abrir PDF">
          Ver PDF
        </Button>
      </View>
      {uriPdf && (
        <View style={styles.botoes}>
          <Button mode="contained" icon="share-variant" buttonColor={COLORS.primary} style={styles.botaoMeio} onPress={compartilhar} accessibilityLabel="Compartilhar PDF">
            Compartilhar
          </Button>
        </View>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.numero}>{ordem.numero}</Text>

          <View style={styles.linha}>
            <Text style={styles.label}>Fornecedor</Text>
            <Text style={styles.valor}>{ordem.fornecedor}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.label}>Assunto</Text>
            <Text style={styles.valor}>{ordem.assunto}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.label}>Valor</Text>
            <Text style={styles.valorDestaque}>{formatarMoeda(ordem.valor)}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.label}>Tipo chave PIX</Text>
            <Text style={styles.valor}>{labelTipoChave[ordem.tipoChavePix]}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.label}>Chave PIX</Text>
            <Text style={styles.valor}>{ordem.pixInfo}</Text>
          </View>
          <View style={styles.linha}>
            <Text style={styles.label}>Criado em</Text>
            <Text style={styles.valor}>{new Date(ordem.criadoEm).toLocaleDateString('pt-BR')}</Text>
          </View>
        </Card.Content>
      </Card>

      {ordem.imagemUri ? (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.imagemHeader}>
              <MaterialCommunityIcons name="image" size={16} color={COLORS.textSecondary} />
              <Text style={styles.imagemLabel}>Imagem do pedido</Text>
            </View>
            <Image source={{ uri: ordem.imagemUri }} style={styles.imagem} resizeMode="contain" />
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.imagemHeader}>
              <MaterialCommunityIcons name="image-off-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.imagemLabel}>Sem imagem anexada</Text>
            </View>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  erroTexto: { ...FONT.body, color: COLORS.danger },
  content: { padding: SPACING.md },
  botoes: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  botaoMeio: { flex: 1, borderRadius: RADIUS.pill },
  card: { borderRadius: RADIUS.lg, marginBottom: SPACING.md, backgroundColor: COLORS.surface, ...SHADOW.sm },
  numero: { ...FONT.h3, color: COLORS.warning, marginBottom: SPACING.sm },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { ...FONT.body, color: COLORS.textSecondary },
  valor: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  valorDestaque: { ...FONT.bodyStrong, color: COLORS.warning },
  imagemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  imagemLabel: { ...FONT.caption, color: COLORS.textSecondary, marginLeft: 4 },
  imagem: { width: '100%', height: 300, borderRadius: RADIUS.md },
});
