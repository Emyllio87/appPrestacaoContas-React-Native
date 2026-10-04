import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { DiariaFuncionario, DiariaRegistro, DiariaFechamento, TipoChavePix } from '../types';
import { formatarMoeda } from '../utils/formatacao';
import { gerarArquivoPdf } from './pdfWriter';

const LABELS_CHAVE: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
};

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data: Date): string {
  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dataFormatada} às ${horaFormatada}`;
}

function formatarNumero(valor: number): string {
  const valorAbsoluto = Math.abs(valor).toFixed(2);
  const [inteiro, decimal] = valorAbsoluto.split('.');
  const inteiroComPontos = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sinal = valor < 0 ? '-' : '';
  return `${sinal}${inteiroComPontos},${decimal}`;
}

function gerarLinhasTabela(registros: DiariaRegistro[], valorDiaria: number): string {
  const registrosOrdenados = [...registros].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  return registrosOrdenados
    .map((r) => {
      const valorDia = valorDiaria + (r.valorAdicional ?? 0);
      const observacao = r.observacao ?? '-';
      return `
        <tr>
          <td>${formatarData(r.data)}</td>
          <td style="color: #757575;">${observacao}</td>
          <td>${formatarMoeda(valorDiaria)}</td>
          <td style="color: ${(r.valorAdicional ?? 0) > 0 ? '#1A1A1A' : '#757575'};">${(r.valorAdicional ?? 0) > 0 ? formatarMoeda(r.valorAdicional) : '-'}</td>
          <td style="font-weight: bold;">${formatarMoeda(valorDia)}</td>
        </tr>
      `;
    })
    .join('');
}

export async function gerarPdfDiaria(
  funcionario: DiariaFuncionario,
  registros: DiariaRegistro[],
  fechamento?: DiariaFechamento
): Promise<string> {
  const dataGeracao = formatarDataHora(new Date());
  const periodoInicio = registros.length > 0 ? formatarData(registros[registros.length - 1].data) : '-';
  const periodoFim = registros.length > 0 ? formatarData(registros[0].data) : '-';
  const totalDias = registros.length;
  const totalAdicionais = registros.reduce((soma, r) => soma + (r.valorAdicional ?? 0), 0);
  const valorTotal = totalDias * funcionario.valorDiaria + totalAdicionais;

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          html, body { font-family: Helvetica, Arial, sans-serif; color: #1A1A1A; }
          .pagina { padding: 40px 44px; }
          .header { text-align: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 16px; margin-bottom: 28px; }
          .header .titulo { font-size: 20px; letter-spacing: 0.5px; }
          .header .subtitulo { font-size: 12px; color: #757575; margin-top: 4px; }
          .header .gerado { font-size: 9px; color: #9E9E9E; margin-top: 6px; }
          .secao { margin-bottom: 24px; }
          .secao h2 { font-size: 13px; color: #1A1A1A; border-bottom: 1px solid #E0E0E0; padding-bottom: 6px; margin-bottom: 12px; }
          .dados table { width: 100%; font-size: 12px; }
          .dados td { padding: 6px 0; }
          .dados .campo-label { font-weight: bold; color: #757575; width: 150px; }
          .dados .campo-valor { font-weight: bold; color: #1A1A1A; }
          .tabela { width: 100%; border-collapse: collapse; }
          .tabela th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #1A1A1A; padding: 8px 10px; text-align: left; font-weight: bold; border-bottom: 1px solid #D0D0D0; }
          .tabela td { font-size: 12px; padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-weight: normal; text-align: left; }
          .tabela th:nth-child(n+3), .tabela td:nth-child(n+3) { text-align: right; }
          .resumo table { width: 100%; font-size: 12px; }
          .resumo td { padding: 6px 0; }
          .resumo .campo-label { font-weight: bold; color: #757575; white-space: nowrap; }
          .resumo .campo-valor { font-weight: bold; color: #1A1A1A; text-align: right; white-space: nowrap; }
          .resumo .total-row td { border-top: 1px solid #1A1A1A; padding-top: 10px; font-size: 14px; }
          .resumo .total-valor { color: #1A1A1A; font-weight: bold; }
          .footer { text-align: center; border-top: 1px solid #F0F0F0; padding-top: 10px; font-size: 8px; color: #BDBDBD; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Relatório de Diárias</div>
            <div class="subtitulo">${funcionario.nome} · ${funcionario.funcao}</div>
            <div class="gerado">Gerado em ${dataGeracao}</div>
          </div>

          <div class="secao dados">
            <h2>Dados do Funcionário</h2>
            <table>
              <tr>
                <td class="campo-label">Nome</td>
                <td class="campo-valor">${funcionario.nome}</td>
              </tr>
              <tr>
                <td class="campo-label">Função</td>
                <td class="campo-valor">${funcionario.funcao}</td>
              </tr>
              <tr>
                <td class="campo-label">Telefone</td>
                <td class="campo-valor">${funcionario.telefone}</td>
              </tr>
              <tr>
                <td class="campo-label">Chave PIX (${LABELS_CHAVE[funcionario.tipoChavePix]})</td>
                <td class="campo-valor">${funcionario.pixInfo}</td>
              </tr>
              <tr>
                <td class="campo-label">Valor da diária</td>
                <td class="campo-valor">${formatarMoeda(funcionario.valorDiaria)}</td>
              </tr>
              <tr>
                <td class="campo-label">Período</td>
                <td class="campo-valor">${periodoInicio} a ${periodoFim}</td>
              </tr>
            </table>
          </div>

          <div class="secao registros">
            <h2>Dias Trabalhados</h2>
            <table class="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Observação</th>
                  <th>Diária</th>
                  <th>Adicional</th>
                  <th>Total do dia</th>
                </tr>
              </thead>
              <tbody>
                ${gerarLinhasTabela(registros, funcionario.valorDiaria)}
              </tbody>
            </table>
          </div>

          <div class="secao resumo">
            <h2>Resumo Financeiro</h2>
            <table>
              <tr>
                <td class="campo-label">Total de dias</td>
                <td class="campo-valor">${totalDias}</td>
              </tr>
              <tr>
                <td class="campo-label">Valor diárias</td>
                <td class="campo-valor">${formatarMoeda(funcionario.valorDiaria)} × ${totalDias} = ${formatarMoeda(totalDias * funcionario.valorDiaria)}</td>
              </tr>
              <tr>
                <td class="campo-label">Valores adicionais</td>
                <td class="campo-valor">${formatarMoeda(totalAdicionais)}</td>
              </tr>
              <tr class="total-row">
                <td class="campo-label">Valor total</td>
                <td class="campo-valor total-valor">${formatarMoeda(valorTotal)}</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            Documento gerado automaticamente · ${dataGeracao}
          </div>
        </div>
      </body>
    </html>
  `;

  return gerarArquivoPdf(html, `diaria_${funcionario.nome.replace(/\s+/g, '_')}.pdf`);
}

export async function abrirPdfDiaria(uri: string): Promise<void> {
  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      extra: { 'android.intent.extra.MIME_TYPE': 'application/pdf' },
    });
  } else {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Abrir PDF',
    });
  }
}

export async function compartilharPdfDiaria(uri: string): Promise<void> {
  const disponivel = await Sharing.isAvailableAsync();
  if (!disponivel) return;

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Compartilhar relatório de diárias',
  });
}

export async function gerarPdfGeralDiaria(
  funcionario: DiariaFuncionario,
  fechamentos: DiariaFechamento[],
  registros: DiariaRegistro[]
): Promise<string> {
  const dataGeracao = formatarDataHora(new Date());

  const linhasFechamentos = fechamentos
    .sort((a, b) => new Date(a.periodoInicio).getTime() - new Date(b.periodoInicio).getTime())
    .map((f) => {
      return `
        <tr>
          <td>${formatarData(f.periodoInicio)} a ${formatarData(f.periodoFim)}</td>
          <td style="text-align: center;">${f.totalDias}</td>
          <td>${formatarMoeda(f.valorDiarias)}</td>
          <td>${formatarMoeda(f.valorAdicionais)}</td>
          <td style="font-weight: bold;">${formatarMoeda(f.valorTotal)}</td>
          <td style="text-align: center;">${f.status === 'pago' ? 'Pago' : 'Fechado'}</td>
        </tr>
      `;
    })
    .join('');

  const totalDias = fechamentos.reduce((s, f) => s + f.totalDias, 0);
  const totalGeral = fechamentos.reduce((s, f) => s + f.valorTotal, 0);

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          html, body { font-family: Helvetica, Arial, sans-serif; color: #1A1A1A; }
          .pagina { padding: 40px 44px; }
          .header { text-align: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 16px; margin-bottom: 28px; }
          .header .titulo { font-size: 20px; letter-spacing: 0.5px; }
          .header .subtitulo { font-size: 12px; color: #757575; margin-top: 4px; }
          .header .gerado { font-size: 9px; color: #9E9E9E; margin-top: 6px; }
          .secao { margin-bottom: 24px; }
          .secao h2 { font-size: 13px; color: #1A1A1A; border-bottom: 1px solid #E0E0E0; padding-bottom: 6px; margin-bottom: 12px; }
          .dados table { width: 100%; font-size: 12px; }
          .dados td { padding: 6px 0; }
          .dados .campo-label { font-weight: bold; color: #757575; width: 150px; }
          .dados .campo-valor { font-weight: bold; color: #1A1A1A; }
          .tabela { width: 100%; border-collapse: collapse; }
          .tabela th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #1A1A1A; padding: 8px 10px; text-align: left; font-weight: bold; border-bottom: 1px solid #D0D0D0; }
          .tabela td { font-size: 12px; padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-weight: normal; text-align: left; }
          .tabela th:nth-child(n+3), .tabela td:nth-child(n+3) { text-align: right; }
          .tabela th:nth-child(2), .tabela td:nth-child(2), .tabela th:last-child, .tabela td:last-child { text-align: center; }
          .resumo table { width: 100%; font-size: 12px; }
          .resumo td { padding: 6px 0; }
          .resumo .campo-label { font-weight: bold; color: #757575; white-space: nowrap; }
          .resumo .campo-valor { font-weight: bold; color: #1A1A1A; text-align: right; white-space: nowrap; }
          .resumo .total-row td { border-top: 1px solid #1A1A1A; padding-top: 10px; font-size: 14px; }
          .resumo .total-valor { color: #1A1A1A; font-weight: bold; }
          .footer { text-align: center; border-top: 1px solid #F0F0F0; padding-top: 10px; font-size: 8px; color: #BDBDBD; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Relatório Geral de Diárias</div>
            <div class="subtitulo">${funcionario.nome} · ${funcionario.funcao}</div>
            <div class="gerado">Gerado em ${dataGeracao}</div>
          </div>
          <div class="secao dados">
            <h2>Dados do Funcionário</h2>
            <table>
              <tr><td class="campo-label">Nome</td><td class="campo-valor">${funcionario.nome}</td></tr>
              <tr><td class="campo-label">Função</td><td class="campo-valor">${funcionario.funcao}</td></tr>
              <tr><td class="campo-label">Telefone</td><td class="campo-valor">${funcionario.telefone}</td></tr>
              <tr><td class="campo-label">Chave PIX (${LABELS_CHAVE[funcionario.tipoChavePix]})</td><td class="campo-valor">${funcionario.pixInfo}</td></tr>
              <tr><td class="campo-label">Valor da diária</td><td class="campo-valor">${formatarMoeda(funcionario.valorDiaria)}</td></tr>
            </table>
          </div>
          <div class="secao registros">
            <h2>Períodos Fechados</h2>
            <table class="tabela">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Dias</th>
                  <th>Diárias</th>
                  <th>Adicionais</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${linhasFechamentos}</tbody>
            </table>
          </div>
          <div class="secao resumo">
            <h2>Resumo Geral</h2>
            <table>
              <tr><td class="campo-label">Total de períodos</td><td class="campo-valor">${fechamentos.length}</td></tr>
              <tr><td class="campo-label">Total de dias trabalhados</td><td class="campo-valor">${totalDias}</td></tr>
              <tr class="total-row"><td class="campo-label">Valor total geral</td><td class="campo-valor total-valor">${formatarMoeda(totalGeral)}</td></tr>
            </table>
          </div>
          <div class="footer">Documento gerado automaticamente · ${dataGeracao}</div>
        </div>
      </body>
    </html>
  `;

  return gerarArquivoPdf(html, `relatorio_geral_${funcionario.nome.replace(/\s+/g, '_')}.pdf`);
}

interface FuncionarioPeriodo {
  funcionario: DiariaFuncionario;
  fechamentos: DiariaFechamento[];
  totalDias: number;
  valorTotal: number;
}

export async function gerarPdfPagamentoPeriodo(
  funcionarios: FuncionarioPeriodo[],
  periodoInicio: Date,
  periodoFim: Date
): Promise<string> {
  const dataGeracao = formatarDataHora(new Date());
  const formatarDataCurta = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const periodoTexto = `${formatarDataCurta(periodoInicio)} a ${formatarDataCurta(periodoFim)}`;

  const linhas = funcionarios
    .sort((a, b) => a.funcionario.nome.localeCompare(b.funcionario.nome))
    .map((f) => {
      return `
        <tr>
          <td>${f.funcionario.nome}</td>
          <td>${f.funcionario.funcao}</td>
          <td>${f.totalDias}</td>
          <td>${formatarNumero(f.funcionario.valorDiaria)}</td>
          <td>${formatarNumero(f.valorTotal)}</td>
          <td>${LABELS_CHAVE[f.funcionario.tipoChavePix]}</td>
          <td style="color: #000000;">${f.funcionario.pixInfo}</td>
        </tr>
      `;
    })
    .join('');

  const totalFuncionarios = funcionarios.length;
  const totalDias = funcionarios.reduce((s, f) => s + f.totalDias, 0);
  const totalGeral = funcionarios.reduce((s, f) => s + f.valorTotal, 0);

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          html, body { font-family: Helvetica, Arial, sans-serif; color: #1A1A1A; }
          .pagina { padding: 40px 44px; }
          .header { text-align: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 16px; margin-bottom: 28px; }
          .header .titulo { font-size: 20px; letter-spacing: 0.5px; }
          .header .subtitulo { font-size: 12px; color: #000000; margin-top: 4px; }
          .header .gerado { font-size: 9px; color: #000000; margin-top: 6px; }
          .tabela { width: 100%; border-collapse: collapse; }
          .tabela th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #1A1A1A; padding: 8px 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #D0D0D0; }
          .tabela td { font-size: 12px; padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-weight: normal; text-align: center; }
          .resumo { margin-top: 24px; display: flex; justify-content: flex-end; }
          .resumo table { border-collapse: collapse; }
          .resumo td { padding: 6px 12px; font-size: 12px; }
          .resumo .label { color: #000000; }
          .resumo .valor { font-weight: 600; text-align: right; }
          .resumo .total-row td { border-top: 1px solid #1A1A1A; font-size: 14px; padding-top: 10px; }
          .resumo .total-row .label { color: #1A1A1A; font-weight: 600; }
          .resumo .total-valor { font-weight: 700; }
          .footer { text-align: center; border-top: 1px solid #F0F0F0; padding-top: 10px; font-size: 8px; color: #000000; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Relatório de Pagamentos</div>
            <div class="subtitulo">Período: ${periodoTexto}</div>
            <div class="gerado">Gerado em ${dataGeracao}</div>
          </div>
          <table class="tabela">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Função</th>
                <th>Dias</th>
                <th>Diária</th>
                <th>Total</th>
                <th>Tipo chave PIX</th>
                <th>Chave PIX</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
          <div class="resumo">
            <table>
              <tr><td class="label">Funcionários</td><td class="valor">${totalFuncionarios}</td></tr>
              <tr><td class="label">Total de dias</td><td class="valor">${totalDias}</td></tr>
              <tr class="total-row"><td class="label">Valor total</td><td class="valor total-valor">${formatarNumero(totalGeral)}</td></tr>
            </table>
          </div>
          <div class="footer">Documento gerado automaticamente · ${dataGeracao}</div>
        </div>
      </body>
    </html>
  `;

  return gerarArquivoPdf(html, `pagamentos_${formatarDataCurta(periodoInicio).replace(/\//g, '-')}_a_${formatarDataCurta(periodoFim).replace(/\//g, '-')}.pdf`);
}

export async function gerarPdfResumoPagamento(
  funcionarios: FuncionarioPeriodo[],
  periodoInicio: Date,
  periodoFim: Date
): Promise<string> {
  const dataGeracao = formatarDataHora(new Date());
  const formatarDataCurta = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const periodoTexto = `${formatarDataCurta(periodoInicio)} a ${formatarDataCurta(periodoFim)}`;

  const linhas = funcionarios
    .sort((a, b) => a.funcionario.nome.localeCompare(b.funcionario.nome))
    .map((f) => {
      return `
        <tr>
          <td>${f.funcionario.nome}</td>
          <td>${formatarNumero(f.valorTotal)}</td>
          <td style="color: #000000;">${LABELS_CHAVE[f.funcionario.tipoChavePix]}</td>
          <td style="color: #000000;">${f.funcionario.pixInfo}</td>
        </tr>
      `;
    })
    .join('');

  const totalGeral = funcionarios.reduce((s, f) => s + f.valorTotal, 0);

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0; }
          html, body { font-family: Helvetica, Arial, sans-serif; color: #1A1A1A; }
          .pagina { padding: 40px 44px; }
          .header { text-align: center; border-bottom: 1px solid #E0E0E0; padding-bottom: 16px; margin-bottom: 28px; }
          .header .titulo { font-size: 20px; letter-spacing: 0.5px; }
          .header .subtitulo { font-size: 12px; color: #000000; margin-top: 4px; }
          .header .gerado { font-size: 9px; color: #000000; margin-top: 6px; }
          .tabela { width: 100%; border-collapse: collapse; }
          .tabela th { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: #1A1A1A; padding: 8px 10px; text-align: center; font-weight: bold; border-bottom: 1px solid #D0D0D0; }
          .tabela td { font-size: 12px; padding: 12px 10px; border-bottom: 1px solid #F0F0F0; font-weight: normal; text-align: center; }
          .resumo { margin-top: 24px; display: flex; justify-content: flex-end; }
          .resumo table { border-collapse: collapse; }
          .resumo td { padding: 6px 12px; font-size: 12px; }
          .resumo .total-row td { border-top: 1px solid #1A1A1A; font-size: 14px; padding-top: 10px; }
          .resumo .total-row .label { color: #1A1A1A; font-weight: 600; }
          .resumo .total-valor { font-weight: 700; text-align: right; }
          .footer { text-align: center; border-top: 1px solid #F0F0F0; padding-top: 10px; font-size: 8px; color: #000000; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="pagina">
          <div class="header">
            <div class="titulo">Pagamento Diárias</div>
            <div class="subtitulo">Período: ${periodoTexto}</div>
            <div class="gerado">Gerado em ${dataGeracao}</div>
          </div>
          <table class="tabela">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Valor</th>
                <th>Tipo chave PIX</th>
                <th>Chave PIX</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
          <div class="resumo">
            <table>
              <tr class="total-row"><td class="label">Valor total</td><td class="valor total-valor">${formatarNumero(totalGeral)}</td></tr>
            </table>
          </div>
          <div class="footer">Documento gerado automaticamente · ${dataGeracao}</div>
        </div>
      </body>
    </html>
  `;

  return gerarArquivoPdf(html, `resumo_pagamento_${formatarDataCurta(periodoInicio).replace(/\//g, '-')}_a_${formatarDataCurta(periodoFim).replace(/\//g, '-')}.pdf`);
}
