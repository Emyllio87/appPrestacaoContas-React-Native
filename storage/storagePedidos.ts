import AsyncStorage from '@react-native-async-storage/async-storage';
import { PedidoCotacao } from '../types';

const CHAVE = '@pedidos_cotacao';

export async function obterProximoNumero(): Promise<string> {
  const dados = await carregarPedidos();
  const proximoNumero = dados.length + 1;
  return `SO-${String(proximoNumero).padStart(3, '0')}`;
}

export async function salvarPedido(pedido: PedidoCotacao): Promise<void> {
  const dados = await carregarPedidos();
  dados.push(pedido);
  await AsyncStorage.setItem(CHAVE, JSON.stringify(dados));
}

export async function carregarPedidos(): Promise<PedidoCotacao[]> {
  const json = await AsyncStorage.getItem(CHAVE);
  return json ? JSON.parse(json) : [];
}

export async function excluirPedido(id: string): Promise<void> {
  const dados = await carregarPedidos();
  const filtrados = dados.filter((p) => p.id !== id);
  await AsyncStorage.setItem(CHAVE, JSON.stringify(filtrados));
}

export async function atualizarPedido(pedido: PedidoCotacao): Promise<void> {
  const dados = await carregarPedidos();
  const index = dados.findIndex((p) => p.id === pedido.id);
  if (index !== -1) {
    dados[index] = pedido;
    await AsyncStorage.setItem(CHAVE, JSON.stringify(dados));
  }
}
