import { PdfRuntime, runtimePadrao } from '../../services/pdfRuntime';

export interface MetricasRuntime {
  chamadas: number;
  emAndamento: number;
  maximoEmAndamento: number;
}

export interface RuntimeInstrumentado {
  runtime: PdfRuntime;
  metricas: MetricasRuntime;
  reiniciar(): void;
}

/** Envolve o runtime real contando a concorrência máxima das operações nativas. */
export function instrumentarRuntime(base: PdfRuntime = runtimePadrao): RuntimeInstrumentado {
  const metricas: MetricasRuntime = {
    chamadas: 0,
    emAndamento: 0,
    maximoEmAndamento: 0,
  };

  const rastrear = async <T>(fn: () => Promise<T>): Promise<T> => {
    metricas.chamadas += 1;
    metricas.emAndamento += 1;
    metricas.maximoEmAndamento = Math.max(metricas.maximoEmAndamento, metricas.emAndamento);
    try {
      return await fn();
    } finally {
      metricas.emAndamento -= 1;
    }
  };

  const runtime: PdfRuntime = {
    documentDirectory: base.documentDirectory,
    printParaBase64: (html) => rastrear(() => base.printParaBase64(html)),
    lerBase64: (uri) => rastrear(() => base.lerBase64(uri)),
    obterInfo: (uri) => rastrear(() => base.obterInfo(uri)),
    redimensionar: (uri, largura, qualidade) =>
      rastrear(() => base.redimensionar(uri, largura, qualidade)),
    gravarBase64: (destino, conteudo) => rastrear(() => base.gravarBase64(destino, conteudo)),
  };

  return {
    runtime,
    metricas,
    reiniciar() {
      metricas.chamadas = 0;
      metricas.emAndamento = 0;
      metricas.maximoEmAndamento = 0;
    },
  };
}
