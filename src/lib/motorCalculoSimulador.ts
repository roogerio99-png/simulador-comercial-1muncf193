export interface CalculoEntrada {
  precoBaseUnitario: number
  quantidade: number
  margemLucroPerc: number
  freteTotal: number
  aliquotaIcmsPerc: number
  reducaoBaseIcmsPerc?: number
  diferimentoIcmsPerc?: number
  aliquotaPisPerc: number
  aliquotaCofinsPerc: number
  incluirIbsCbs: boolean
  aliquotaIbsPerc?: number
  aliquotaCbsPerc?: number
}

export interface CalculoResultado {
  baseBrutaUnitario: number
  baseBrutaTotal: number
  margemLucroUnitario: number
  margemLucroTotal: number
  freteUnitario: number
  freteTotal: number
  custoOperacionalTotal: number

  // ICMS
  aliquotaIcmsEfetivaPerc: number
  baseCalculoIcms: number
  icmsUnitario: number
  icmsTotal: number

  // PIS / COFINS
  pisUnitario: number
  pisTotal: number
  cofinsUnitario: number
  cofinsTotal: number

  // IBS / CBS (2027)
  ibsUnitario: number
  ibsTotal: number
  cbsUnitario: number
  cbsTotal: number

  totalTributosTotal: number
  precoFinalUnitario: number
  precoFinalTotal: number

  // Percentuais de composição sobre o preço final
  composicao: {
    baseMargem: number
    icms: number
    pis: number
    cofins: number
    ibs: number
    cbs: number
  }
}

export function calcularPrecoSimulador(input: CalculoEntrada): CalculoResultado {
  const qtd = Math.max(input.quantidade || 1, 1)
  const precoBaseUnit = Math.max(input.precoBaseUnitario || 0, 0)
  const margemPerc = (input.margemLucroPerc || 0) / 100
  const freteTot = Math.max(input.freteTotal || 0, 0)
  const freteUnit = freteTot / qtd

  // Base comercial pura
  const baseBrutaTotal = precoBaseUnit * qtd
  const margemLucroUnit = precoBaseUnit * margemPerc
  const margemLucroTotal = margemLucroUnit * qtd
  const custoOperacionalTotal = baseBrutaTotal + margemLucroTotal + freteTot

  // Alíquotas e Efetividade de ICMS
  const aliqIcmsNominal = (input.aliquotaIcmsPerc || 0) / 100
  const redBase = (input.reducaoBaseIcmsPerc || 0) / 100
  const dif = (input.diferimentoIcmsPerc || 0) / 100

  // Alíquota efetiva considerando redução de base e diferimento
  let fatorEfetivoIcms = (1 - redBase) * (1 - dif)
  if (fatorEfetivoIcms < 0) fatorEfetivoIcms = 0
  const aliqIcmsEfetiva = aliqIcmsNominal * fatorEfetivoIcms

  // Impostos calculados sobre a base de operação
  const baseCalculoIcms = custoOperacionalTotal * (1 - redBase)
  const icmsTotal = baseCalculoIcms * (aliqIcmsNominal * (1 - dif))
  const icmsUnit = icmsTotal / qtd

  // PIS e COFINS
  const aliqPis = (input.aliquotaPisPerc || 0) / 100
  const aliqCofins = (input.aliquotaCofinsPerc || 0) / 100
  const pisTotal = custoOperacionalTotal * aliqPis
  const pisUnit = pisTotal / qtd
  const cofinsTotal = custoOperacionalTotal * aliqCofins
  const cofinsUnit = cofinsTotal / qtd

  // IBS e CBS 2027 (se ativados)
  let ibsTotal = 0
  let cbsTotal = 0
  if (input.incluirIbsCbs) {
    const aliqIbs = (input.aliquotaIbsPerc || 0) / 100
    const aliqCbs = (input.aliquotaCbsPerc || 0) / 100
    ibsTotal = custoOperacionalTotal * aliqIbs
    cbsTotal = custoOperacionalTotal * aliqCbs
  }
  const ibsUnit = ibsTotal / qtd
  const cbsUnit = cbsTotal / qtd

  const totalTributosTotal = icmsTotal + pisTotal + cofinsTotal + ibsTotal + cbsTotal
  const precoFinalTotal = custoOperacionalTotal + totalTributosTotal
  const precoFinalUnitario = precoFinalTotal / qtd

  // Composição percentual para o gráfico de barras empilhadas
  const denom = precoFinalTotal > 0 ? precoFinalTotal : 1
  const compBaseMargem = (custoOperacionalTotal / denom) * 100
  const compIcms = (icmsTotal / denom) * 100
  const compPis = (pisTotal / denom) * 100
  const compCofins = (cofinsTotal / denom) * 100
  const compIbs = (ibsTotal / denom) * 100
  const compCbs = (cbsTotal / denom) * 100

  return {
    baseBrutaUnitario: precoBaseUnit,
    baseBrutaTotal,
    margemLucroUnitario: margemLucroUnit,
    margemLucroTotal,
    freteUnitario: freteUnit,
    freteTotal: freteTot,
    custoOperacionalTotal,

    aliquotaIcmsEfetivaPerc: aliqIcmsEfetiva * 100,
    baseCalculoIcms,
    icmsUnitario: icmsUnit,
    icmsTotal,

    pisUnitario: pisUnit,
    pisTotal,
    cofinsUnitario: cofinsUnit,
    cofinsTotal,

    ibsUnitario: ibsUnit,
    ibsTotal,
    cbsUnitario: cbsUnit,
    cbsTotal,

    totalTributosTotal,
    precoFinalUnitario,
    precoFinalTotal,

    composicao: {
      baseMargem: compBaseMargem,
      icms: compIcms,
      pis: compPis,
      cofins: compCofins,
      ibs: compIbs,
      cbs: compCbs,
    },
  }
}
