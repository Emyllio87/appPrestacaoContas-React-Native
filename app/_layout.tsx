import { useEffect, useState } from 'react';
import { Text, StyleSheet, Animated, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS, SPACING, FONT } from '../constants/theme';
import { LogoApp } from '../components/LogoApp';

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...MD3LightTheme,
  roundness: 10,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.primary,
    onPrimary: COLORS.surface,
    primaryContainer: COLORS.primaryLight,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceVariant: COLORS.background,
    outline: COLORS.border,
    onSurface: COLORS.textPrimary,
    error: COLORS.danger,
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [mostrarAbertura, setMostrarAbertura] = useState(true);
  const [opacidade] = useState(new Animated.Value(1));

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    const temporizador = setTimeout(() => {
      Animated.timing(opacidade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setMostrarAbertura(false));
    }, 1400);

    return () => clearTimeout(temporizador);
  }, []);

  return (
    <PaperProvider theme={theme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.surface,
          headerTitleStyle: FONT.title,
          headerTitleAlign: 'center',
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Sistema de Gestão',
            headerRight: () => (
              <Pressable
                onPress={() => router.push('/configuracoes')}
                hitSlop={8}
                style={{ marginRight: 4 }}
              >
                <MaterialCommunityIcons name="cog-outline" size={24} color={COLORS.surface} />
              </Pressable>
            ),
          }}
        />
        <Stack.Screen name="configuracoes" options={{ title: 'Configurações' }} />
        <Stack.Screen name="categorias" options={{ title: 'Categorias' }} />

        {/* Prestações de Contas */}
        <Stack.Screen name="prestacoes" options={{ title: 'Prestações de Contas' }} />
        <Stack.Screen name="nova-prestacao" options={{ title: 'Nova prestação', presentation: 'modal' }} />
        <Stack.Screen name="prestacao/[id]/index" options={{ title: 'Detalhes da prestação' }} />
        <Stack.Screen name="prestacao/[id]/nova-despesa" options={{ title: 'Nova despesa', presentation: 'modal' }} />
        <Stack.Screen name="prestacao/[id]/editar-despesa" options={{ title: 'Editar despesa', presentation: 'modal' }} />
        <Stack.Screen name="prestacao/[id]/editar-prestacao" options={{ title: 'Editar prestação', presentation: 'modal' }} />

        {/* Diárias */}
        <Stack.Screen name="diarias/menu" options={{ title: 'Diárias' }} />
        <Stack.Screen name="diarias/index" options={{ title: 'Funcionários' }} />
        <Stack.Screen name="diarias/pagamentos" options={{ title: 'Pagamentos' }} />
        <Stack.Screen name="diarias/pagamentos/lista" options={{ title: 'Realizar Pagamentos' }} />
        <Stack.Screen name="diarias/novo-funcionario" options={{ title: 'Novo funcionário', presentation: 'modal' }} />
        <Stack.Screen name="diarias/[id]/index" options={{ title: 'Detalhes do funcionário' }} />
        <Stack.Screen name="diarias/[id]/editar-funcionario" options={{ title: 'Editar funcionário', presentation: 'modal' }} />
        <Stack.Screen name="diarias/[id]/historico" options={{ title: 'Histórico de Quinzenas' }} />
        <Stack.Screen name="diarias/[id]/registrar-dia" options={{ title: 'Registrar dia', presentation: 'modal' }} />
        <Stack.Screen name="diarias/[id]/editar-registro" options={{ title: 'Editar registro', presentation: 'modal' }} />
        <Stack.Screen name="diarias/[id]/fechar-pagamento" options={{ title: 'Fechar pagamento', presentation: 'modal' }} />

        {/* Ordens de Pagamento */}
        <Stack.Screen name="ordens-pagamento/index" options={{ title: 'Ordens de Pagamento' }} />
        <Stack.Screen name="ordens-pagamento/solicitacao" options={{ title: 'Solicitação de Ordem' }} />
        <Stack.Screen name="ordens-pagamento/nova-ordem" options={{ title: 'Nova ordem', presentation: 'modal' }} />
        <Stack.Screen name="ordens-pagamento/historico" options={{ title: 'Histórico de Ordens' }} />
        <Stack.Screen name="ordens-pagamento/[id]/index" options={{ title: 'Detalhes da ordem' }} />
        <Stack.Screen name="ordens-pagamento/[id]/editar-ordem" options={{ title: 'Editar ordem', presentation: 'modal' }} />

        {/* Orçamentos */}
        <Stack.Screen name="pedidos/index" options={{ title: 'Orçamentos' }} />
        <Stack.Screen name="pedidos/cotacao" options={{ title: 'Solicitação de Orçamento' }} />
        <Stack.Screen name="pedidos/historico" options={{ title: 'Histórico de Orçamentos' }} />
        <Stack.Screen name="pedidos/editar" options={{ title: 'Editar Pedido', presentation: 'modal' }} />
      </Stack>

      {mostrarAbertura && (
        <Animated.View style={[styles.abertura, { opacity: opacidade }]}>
          <LogoApp size={100} />
          <Text style={styles.titulo}>Sistema de Gestão</Text>
          <Text style={styles.subtitulo}>Controle simples e profissional</Text>
        </Animated.View>
      )}
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  abertura: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titulo: { marginTop: SPACING.lg, ...FONT.h2, color: COLORS.textPrimary },
  subtitulo: { marginTop: SPACING.sm, ...FONT.body, color: COLORS.textSecondary },
});
