import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { TextInput, Button, Text, Card, HelperText } from 'react-native-paper';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fecharPagamento, getFuncionarios, getRegistrosPendentes } from '../../../storage/storageDiarias';
import { DiariaFuncionario, DiariaRegistro } from '../../../types';
import { gerarPdfDiaria, abrirPdfDiaria } from '../../../services/pdfDiariaService';
import { formatarMoeda } from '../../../utils/formatacao';
import { COLORS, SPACING, RADIUS, SHADOW, FONT } from '../../../constants/theme';

function formatarData(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const a = data.getFullYear();
  return `${d}/${m}/${a}`;
}

export default function FecharPagamento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [funcionario, setFuncionario] = useState<DiariaFuncionario | null>(null);
  const [registros, setRegistros] = useState<DiariaRegistro[]>([]);
  const [periodoInicio, setPeriodoInicio] = useState(new Date());
  const [periodoFim, setPeriodoFim] = useState(new Date());
  const [mostrarInicio, setMostrarInicio] = useState(false);
  const [mostrarFim, setMostrarFim] = useState(false);
  const [totalDias, setTotalDias] = useState(0);
  const [valorDiarias, setValorDiarias] = useState(0);
  const [valorAdicionais, setValorAdicionais] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);
  const [erro, setErro] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => {
    (async () => {
      const funcionarios = await getFuncionarios();
      const f = funcionarios.find((item) => item.id === id);
      if (f) {
        setFuncionario(f);

        const regs = await getRegistrosPendentes(f.id);
        setRegistros(regs);
        if (regs.length > 0) {
          const datas = regs.map((r) => new Date(r.data).getTime());
          const menorData = new Date(Math.min(...datas));
          const maiorData = new Date(Math.max(...datas));
          setPeriodoInicio(menorData);
          setPeriodoFim(maiorData);
          calcularPreview(f, menorData, maiorData, regs);
        }
      }
    })();
  }, [id]);

  const calcularPreview = (f: DiariaFuncionario, inicio: Date, fim: Date, todosRegistros?: DiariaRegistro[]) => {
    const registrosFiltrados = (todosRegistros ?? []).filter((r) => {
      const d = new Date(r.data).getTime();
      return d >= inicio.getTime() && d <= fim.getTime();
    });
    const dias = registrosFiltrados.length;
    const diarias = dias * f.valorDiaria;
    const adicionais = registrosFiltrados.reduce((soma, r) => soma + (r.valorAdicional ?? 0), 0);
    setTotalDias(dias);
    setValorDiarias(diarias);
    setValorAdicionais(adicionais);
    setValorTotal(diarias + adicionais);
  };

  const aoMudarInicio = (event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarInicio(Platform.OS === 'ios');
    if (dataSelecionada) {
      setPeriodoInicio(dataSelecionada);
      if (funcionario) calcularPreview(funcionario, dataSelecionada, periodoFim, registros);
    }
  };

  const aoMudarFim = (event: DateTimePickerEvent, dataSelecionada?: Date) => {
    setMostrarFim(Platform.OS === 'ios');
    if (dataSelecionada) {
      setPeriodoFim(dataSelecionada);
      if (funcionario) calcularPreview(funcionario, periodoInicio, dataSelecionada, registros);
    }
  };

  const confirmar = async () => {
    if (totalDias === 0) {
      setErro('Nenhum dia registrado no período selecionado');
      return;
    }
    await fecharPagamento(id, periodoInicio.toISOString(), periodoFim.toISOString());

    if (funcionario) {
      const registrosFiltrados = registros.filter((r) => {
        const d = new Date(r.data).getTime();
        return d >= periodoInicio.getTime() && d <= periodoFim.getTime();
      });

      setGerandoPdf(true);
      try {
        const uri = await gerarPdfDiaria(funcionario, registrosFiltrados);
        await abrirPdfDiaria(uri);
      } catch {
        // Silently handle PDF generation errors
      } finally {
        setGerandoPdf(false);
      }
    }

    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Fechar pagamento</Text>

      <TouchableOpacity onPress={() => setMostrarInicio(true)} accessibilityRole="button">
        <TextInput label="Data início" mode="outlined" value={formatarData(periodoInicio)} editable={false} style={styles.input} right={<TextInput.Icon icon="calendar" />} />
      </TouchableOpacity>
      {mostrarInicio && (
        <DateTimePicker value={periodoInicio} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={aoMudarInicio} locale="pt-BR" />
      )}

      <TouchableOpacity onPress={() => setMostrarFim(true)} accessibilityRole="button">
        <TextInput label="Data fim" mode="outlined" value={formatarData(periodoFim)} editable={false} style={styles.input} right={<TextInput.Icon icon="calendar" />} />
      </TouchableOpacity>
      {mostrarFim && (
        <DateTimePicker value={periodoFim} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={aoMudarFim} locale="pt-BR" />
      )}

      <HelperText type="error" visible={!!erro}>{erro}</HelperText>

      {funcionario && (
        <Card style={styles.resumoCard}>
          <Card.Content>
            <Text style={styles.resumoTitulo}>Resumo</Text>
            <View style={styles.linha}>
              <Text style={styles.linhaLabel}>Dias trabalhados</Text>
              <Text style={styles.valor}>{totalDias}</Text>
            </View>
            <View style={styles.linha}>
              <Text style={styles.linhaLabel}>Valor diárias ({formatarMoeda(funcionario.valorDiaria)}/dia)</Text>
              <Text style={styles.valor}>{formatarMoeda(valorDiarias)}</Text>
            </View>
            <View style={styles.linha}>
              <Text style={styles.linhaLabel}>Valores adicionais</Text>
              <Text style={styles.valor}>{formatarMoeda(valorAdicionais)}</Text>
            </View>
            <View style={[styles.linha, styles.totalLinha]}>
              <Text style={styles.totalLabel}>Valor total</Text>
              <Text style={styles.totalValor}>{formatarMoeda(valorTotal)}</Text>
            </View>
          </Card.Content>
        </Card>
      )}

      <Button
        mode="contained"
        onPress={confirmar}
        style={styles.button}
        buttonColor={COLORS.primary}
        disabled={totalDias === 0 || gerandoPdf}
        loading={gerandoPdf}
        accessibilityLabel="Confirmar fechamento"
      >
        {gerandoPdf ? 'Gerando PDF...' : 'Confirmar fechamento'}
      </Button>

      <Button mode="text" onPress={() => router.back()} style={styles.botaoCancelar} textColor={COLORS.textSecondary} accessibilityLabel="Cancelar">
        Cancelar
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.lg, backgroundColor: COLORS.surface },
  titulo: { ...FONT.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  input: { marginBottom: 4 },
  resumoCard: { marginVertical: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, ...SHADOW.md },
  resumoTitulo: { ...FONT.title, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  linhaLabel: { ...FONT.body, color: COLORS.textSecondary },
  valor: { ...FONT.bodyStrong, color: COLORS.textPrimary },
  totalLinha: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm, marginTop: SPACING.xs },
  totalLabel: { ...FONT.title, color: COLORS.textPrimary },
  totalValor: { ...FONT.title, color: COLORS.primary },
  button: { marginTop: SPACING.sm, borderRadius: RADIUS.pill },
  botaoCancelar: { marginTop: SPACING.xs },
});
