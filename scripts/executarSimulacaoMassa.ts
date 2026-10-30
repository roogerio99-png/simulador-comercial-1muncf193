/**
 * scripts/executarSimulacaoMassa.ts
 *
 * Executa a simulação em massa do Simulador Comercial Agro
 * contra TODOS os produtos da coleção simulador_produtos,
 * cobrindo as 3 rotas fiscais obrigatórias:
 * 1. Compra SP->MT e Venda MT->SP
 * 2. Compra interna SP->SP e Venda SP->SP
 * 3. Compra SP->MG e Venda MG->MG
 *
 * Utiliza o motor de cálculo real: src/lib/motorSimulador.ts
 */

import {
  executarCalculoSimulador,
  type ProdutoBaseSimulador,
  type RegraIcmsSimulador,
  type SimuladorInput,
  type SimuladorResultado,
} from '../src/lib/motorSimulador'

interface TestRoute {
  nome: string
  ufOrigemCompra: string
  ufDestinoCompra: string
  ufOrigemVenda: string
  ufDestinoVenda: string
}

const ROTAS_TESTE: TestRoute[] = [
  {
    nome: 'SP→MT (Compra) e MT→SP (Venda)',
    ufOrigemCompra: 'SP',
    ufDestinoCompra: 'MT',
    ufOrigemVenda: 'MT',
    ufDestinoVenda: 'SP',
  },
  {
    nome: 'SP→SP (Compra) e SP→SP (Venda) - Interna',
    ufOrigemCompra: 'SP',
    ufDestinoCompra: 'SP',
    ufOrigemVenda: 'SP',
    ufDestinoVenda: 'SP',
  },
  {
    nome: 'SP→MG (Compra) e MG→MG (Venda) - Estado Rico',
    ufOrigemCompra: 'SP',
    ufDestinoCompra: 'MG',
    ufOrigemVenda: 'MG',
    ufDestinoVenda: 'MG',
  },
]

// Mock de produtos especiais caso executado offline / banco
export async function carregarDadosDoBackend(baseUrl: string) {
  const url = `${baseUrl.replace(/\/$/, '')}/backend/v1/simulador/export-data-teste`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Falha ao obter dados: HTTP ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  return json as {
    produtos: ProdutoBaseSimulador[]
    regras: RegraIcmsSimulador[]
  }
}

export async function carregarDadosComFallbackPocketBase(baseUrl?: string): Promise<{
  produtos: ProdutoBaseSimulador[]
  regras: RegraIcmsSimulador[]
}> {
  const url =
    baseUrl ||
    (typeof process !== 'undefined' ? process.env.VITE_POCKETBASE_URL : '') ||
    'http://127.0.0.1:8090'

  // Tenta o endpoint export-data-teste
  try {
    const epUrl = `${url.replace(/\/$/, '')}/backend/v1/simulador/export-data-teste`
    const res = await fetch(epUrl)
    if (res.ok) {
      const json = await res.json()
      if (json.produtos && json.regras) {
        return json as { produtos: ProdutoBaseSimulador[]; regras: RegraIcmsSimulador[] }
      }
    }
  } catch (_) {}

  // Tenta endpoint exportar-dados-completos
  try {
    const epUrl = `${url.replace(/\/$/, '')}/backend/v1/simulador/exportar-dados-completos`
    const res = await fetch(epUrl)
    if (res.ok) {
      const json = await res.json()
      if (json.produtos && json.regras) {
        return json as { produtos: ProdutoBaseSimulador[]; regras: RegraIcmsSimulador[] }
      }
    }
  } catch (_) {}

  throw new Error(`Não foi possível carregar dados de produtos e regras em ${url}`)
}

export async function executarAuditoriaCompletaMassa(
  produtos: ProdutoBaseSimulador[],
  regras: RegraIcmsSimulador[],
) {
  const totalProdutos = produtos.length
  let totalExecucoes = 0
  let totalOk = 0
  let totalErrosCalculo = 0
  let totalSemRegra = 0

  const erros: ResultadoAuditoriaItem[] = []
  const resumoSemRegra: Record<string, number> = {}
  const contagemGrTrib: Record<string, number> = {}
  const amostraCasosBorda: Record<string, ResultadoAuditoriaItem[]> = {
    USD_sem_ptax_manual: [],
    embalagem_vazia: [],
    unidade_L_fertilizante_solido: [],
  }

  for (const produto of produtos) {
    let gr = (produto.gr_trib || '').trim()
    if (gr.length > 0 && gr.length < 3) gr = gr.padStart(3, '0')
    contagemGrTrib[gr || 'SEM_GR'] = (contagemGrTrib[gr || 'SEM_GR'] || 0) + 1

    for (const rota of ROTAS_TESTE) {
      totalExecucoes++
      const resultado = testarProdutoRota(produto, rota, regras)

      if (resultado.status === 'OK') {
        totalOk++
      } else if (resultado.status === 'ERRO_CALCULO') {
        totalErrosCalculo++
        erros.push(resultado)
      } else if (resultado.status === 'SEM_REGRA') {
        totalSemRegra++
        const ch = `${rota.nome} | GrTrib ${gr || 'SEM_GR'} (${resultado.motivoErro || 'Sem regra'})`
        resumoSemRegra[ch] = (resumoSemRegra[ch] || 0) + 1
      }

      // Casos de borda solicitados:
      if (produto.codigo === '006802') {
        amostraCasosBorda['USD_sem_ptax_manual'].push(resultado)
      }
      if (produto.codigo === '007216' || produto.codigo === '007221') {
        amostraCasosBorda['embalagem_vazia'].push(resultado)
      }
      if (produto.codigo === '007100') {
        amostraCasosBorda['unidade_L_fertilizante_solido'].push(resultado)
      }
    }
  }

  return {
    totalProdutos,
    totalRotas: ROTAS_TESTE.length,
    totalExecucoes,
    totalOk,
    totalErrosCalculo,
    totalSemRegra,
    erros,
    resumoSemRegra,
    contagemGrTrib,
    amostraCasosBorda,
  }
}

export function encontrarRegra(
  regras: RegraIcmsSimulador[],
  ufOrigem: string,
  ufDestino: string,
  grTrib?: string,
): { regra: RegraIcmsSimulador | null; tipoMatch: 'exato' | 'fallback' | 'nenhum' } {
  const orig = (ufOrigem || '').trim().toUpperCase()
  const dest = (ufDestino || '').trim().toUpperCase()
  let gr = (grTrib || '').trim()
  if (gr.length > 0 && gr.length < 3) {
    gr = gr.padStart(3, '0')
  }

  if (gr) {
    const exata = regras.find((r) => {
      let rGr = (r.grupo_tributario_codigo || '').trim()
      if (rGr.length > 0 && rGr.length < 3) rGr = rGr.padStart(3, '0')
      return (
        r.uf_origem?.toUpperCase() === orig && r.uf_destino?.toUpperCase() === dest && rGr === gr
      )
    })
    if (exata) return { regra: exata, tipoMatch: 'exato' }
  }

  const fallback = regras.find(
    (r) => r.uf_origem?.toUpperCase() === orig && r.uf_destino?.toUpperCase() === dest,
  )
  if (fallback) return { regra: fallback, tipoMatch: 'fallback' }

  return { regra: null, tipoMatch: 'nenhum' }
}

export interface ResultadoAuditoriaItem {
  codigo: string
  descricao: string
  grTrib: string
  moeda: string
  embalagem: string
  rota: string
  status: 'OK' | 'ERRO_CALCULO' | 'SEM_REGRA'
  tipoRegraCompra: string
  tipoRegraVenda: string
  motivoErro?: string
  detalhes?: {
    custoTotalCompra: number
    precoVendaSugerido: number
    markupMultiplicador: number
    resultadoFinal: number
    dreTotalLinhas: number
  }
}

export function testarProdutoRota(
  produto: ProdutoBaseSimulador,
  rota: TestRoute,
  regras: RegraIcmsSimulador[],
  opcoes?: { ptaxDefault?: number; precoCompraDefault?: number },
): ResultadoAuditoriaItem {
  const { regra: regraCompra, tipoMatch: matchCompra } = encontrarRegra(
    regras,
    rota.ufOrigemCompra,
    rota.ufDestinoCompra,
    produto.gr_trib,
  )

  const { regra: regraVenda, tipoMatch: matchVenda } = encontrarRegra(
    regras,
    rota.ufOrigemVenda,
    rota.ufDestinoVenda,
    produto.gr_trib,
  )

  const temRegraFiscal = regraCompra !== null && regraVenda !== null
  const semRegraMotivo = !regraCompra
    ? `Compra sem regra para ${rota.ufOrigemCompra}→${rota.ufDestinoCompra}`
    : !regraVenda
      ? `Venda sem regra para ${rota.ufOrigemVenda}→${rota.ufDestinoVenda}`
      : ''

  // Conjunto de entradas padrão plausível para o produto
  const ptax = opcoes?.ptaxDefault ?? 5.75
  const precoBaseCompra =
    produto.preco_base_sugerido && produto.preco_base_sugerido > 0
      ? produto.preco_base_sugerido
      : (opcoes?.precoCompraDefault ?? 100)

  const input: SimuladorInput = {
    produto,
    quantidade: 1000,
    ptaxManual: ptax,
    compra: {
      dataOperacao: '2026-10-30',
      prazoDias: 30,
      precoUnitario: precoBaseCompra,
      moeda: produto.moeda?.toUpperCase() === 'USD' ? 'USD' : 'BRL',
      ptaxManual: ptax,
      ufOrigem: rota.ufOrigemCompra,
      ufDestino: rota.ufDestinoCompra,
      regraIcms: regraCompra,
      modalidadeFrete: 'FOB',
      frete: 1200,
      seguro: 200,
      outrasDespesas: 100,
      taxaJurosMensalPerc: 1.2,
      creditarIcms: true,
    },
    venda: {
      dataOperacao: '2026-10-30',
      prazoDias: 60,
      precoUnitario: precoBaseCompra * 1.35,
      moeda: produto.moeda?.toUpperCase() === 'USD' ? 'USD' : 'BRL',
      ptaxManual: ptax,
      ufOrigem: rota.ufOrigemVenda,
      ufDestino: rota.ufDestinoVenda,
      enquadramentoCliente: 'produtor_rural',
      modalidadeFrete: 'CIF',
      frete: 2500,
      seguro: 350,
      outrasDespesas: 150,
      comissaoPerc:
        produto.comissao_padrao !== undefined && produto.comissao_padrao > 0
          ? produto.comissao_padrao * (produto.comissao_padrao < 1 ? 100 : 1)
          : 2.5,
      taxaJurosMensalPerc: 1.8,
      margemAlvoPerc: 15,
      regraIcms: regraVenda,
      considerarReoneracao2026: true,
      usarAliquotaReformaPlena: false,
    },
  }

  let res: SimuladorResultado
  try {
    res = executarCalculoSimulador(input)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      codigo: produto.codigo || 'S/C',
      descricao: produto.descricao,
      grTrib: produto.gr_trib || 'S/GR',
      moeda: produto.moeda || 'BRL',
      embalagem: produto.embalagem || '',
      rota: rota.nome,
      status: 'ERRO_CALCULO',
      tipoRegraCompra: matchCompra,
      tipoRegraVenda: matchVenda,
      motivoErro: `Exceção lançada pelo motor: ${msg}`,
    }
  }

  // Verificações de robustez numérica
  const camposChecagem: Array<{ nome: string; valor: unknown }> = [
    { nome: 'custoTotalComJuros (Compra)', valor: res.compra?.custoTotalComJuros },
    { nome: 'custoAquisicaoMercadoria (Compra)', valor: res.compra?.custoAquisicaoMercadoria },
    { nome: 'receitaLiquida (Venda)', valor: res.venda?.receitaLiquida },
    { nome: 'totalTributos (Venda)', valor: res.venda?.totalTributos },
    { nome: 'resultadoFinalOperacao', valor: res.resultadoOperacao?.resultadoFinalOperacao },
    { nome: 'precoMinimoBreakEven', valor: res.precoMinimoBreakEven },
    { nome: 'precoVendaSugerido', valor: res.precoVendaSugerido },
    { nome: 'precoVendaSugeridoUnitario', valor: res.precoVendaSugeridoUnitario },
    { nome: 'markupMultiplicador', valor: res.markupMultiplicador },
  ]

  const errosDetectados: string[] = []

  for (const c of camposChecagem) {
    if (c.valor === undefined || c.valor === null) {
      errosDetectados.push(`${c.nome} está undefined/null`)
    } else if (typeof c.valor === 'number') {
      if (Number.isNaN(c.valor)) {
        errosDetectados.push(`${c.nome} resultou em NaN`)
      } else if (!Number.isFinite(c.valor)) {
        errosDetectados.push(`${c.nome} resultou em Infinity`)
      }
    }
  }

  // Checagem de integridade da DRE
  if (!res.dre || res.dre.length === 0) {
    errosDetectados.push('DRE vazia')
  } else {
    for (const linha of res.dre) {
      if (Number.isNaN(linha.total) || !Number.isFinite(linha.total)) {
        errosDetectados.push(`Linha DRE "${linha.descricao}" total NaN ou Infinity`)
      }
      if (Number.isNaN(linha.unitario) || !Number.isFinite(linha.unitario)) {
        errosDetectados.push(`Linha DRE "${linha.descricao}" unitario NaN ou Infinity`)
      }
    }
  }

  // Preço sugerido ou break-even negativos ou zerados quando há custo
  if (res.compra.custoTotalComJuros > 0) {
    if (res.precoMinimoBreakEven <= 0) {
      errosDetectados.push(`Break-even <= 0 (${res.precoMinimoBreakEven}) com custo positivo`)
    }
    if (res.precoVendaSugerido <= 0) {
      errosDetectados.push(`Preço sugerido <= 0 (${res.precoVendaSugerido}) com custo positivo`)
    }
    if (res.markupMultiplicador <= 0) {
      errosDetectados.push(`Markup <= 0 (${res.markupMultiplicador})`)
    }
  }

  if (errosDetectados.length > 0) {
    return {
      codigo: produto.codigo || 'S/C',
      descricao: produto.descricao,
      grTrib: produto.gr_trib || 'S/GR',
      moeda: produto.moeda || 'BRL',
      embalagem: produto.embalagem || '',
      rota: rota.nome,
      status: 'ERRO_CALCULO',
      tipoRegraCompra: matchCompra,
      tipoRegraVenda: matchVenda,
      motivoErro: errosDetectados.join('; '),
      detalhes: {
        custoTotalCompra: res.compra.custoTotalComJuros,
        precoVendaSugerido: res.precoVendaSugerido,
        markupMultiplicador: res.markupMultiplicador,
        resultadoFinal: res.resultadoOperacao.resultadoFinalOperacao,
        dreTotalLinhas: res.dre?.length || 0,
      },
    }
  }

  // Se não houve erro de cálculo, mas faltou regra fiscal: categoria "SEM_REGRA"
  if (!temRegraFiscal) {
    return {
      codigo: produto.codigo || 'S/C',
      descricao: produto.descricao,
      grTrib: produto.gr_trib || 'S/GR',
      moeda: produto.moeda || 'BRL',
      embalagem: produto.embalagem || '',
      rota: rota.nome,
      status: 'SEM_REGRA',
      tipoRegraCompra: matchCompra,
      tipoRegraVenda: matchVenda,
      motivoErro: semRegraMotivo,
      detalhes: {
        custoTotalCompra: res.compra.custoTotalComJuros,
        precoVendaSugerido: res.precoVendaSugerido,
        markupMultiplicador: res.markupMultiplicador,
        resultadoFinal: res.resultadoOperacao.resultadoFinalOperacao,
        dreTotalLinhas: res.dre?.length || 0,
      },
    }
  }

  return {
    codigo: produto.codigo || 'S/C',
    descricao: produto.descricao,
    grTrib: produto.gr_trib || 'S/GR',
    moeda: produto.moeda || 'BRL',
    embalagem: produto.embalagem || '',
    rota: rota.nome,
    status: 'OK',
    tipoRegraCompra: matchCompra,
    tipoRegraVenda: matchVenda,
    detalhes: {
      custoTotalCompra: res.compra.custoTotalComJuros,
      precoVendaSugerido: res.precoVendaSugerido,
      markupMultiplicador: res.markupMultiplicador,
      resultadoFinal: res.resultadoOperacao.resultadoFinalOperacao,
      dreTotalLinhas: res.dre?.length || 0,
    },
  }
}
