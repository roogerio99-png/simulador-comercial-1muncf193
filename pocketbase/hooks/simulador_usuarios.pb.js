/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints específicos para o Simulador Comercial (PocketBase v0.23+ JSVM API):
 * - /backend/v1/simulador/setup-admin
 * - /backend/v1/simulador/usuarios
 * - /backend/v1/simulador/usuarios/convidar
 * - /backend/v1/simulador/usuarios/alterar-papel
 * - /backend/v1/simulador/usuarios/excluir
 */

routerAdd('GET', '/backend/v1/simulador/export-data-teste', (e) => {
  // Apenas para suporte a testes internos e diagnósticos
  try {
    const colProdutos = $app.findCollectionByNameOrId('simulador_produtos')
    const colRegras = $app.findCollectionByNameOrId('simulador_regras_icms')

    const produtosRecords = $app.findRecordsByFilter(colProdutos, '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(colRegras, '', 'uf_origem,uf_destino', 10000, 0)

    const produtos = produtosRecords.map((r) => ({
      id: r.id,
      codigo: r.getString('codigo'),
      descricao: r.getString('descricao'),
      ncm: r.getString('ncm'),
      unidade: r.getString('unidade'),
      tipo_produto: r.getString('tipo_produto'),
      origem: r.getString('origem'),
      embalagem: r.getString('embalagem'),
      principio_ativo: r.getString('principio_ativo'),
      fabricante: r.getString('fabricante'),
      moeda: r.getString('moeda'),
      preco_base_sugerido: r.getFloat('preco_base_sugerido'),
      gr_trib: r.getString('gr_trib'),
      grupo_codigo: r.getString('grupo_codigo'),
      grupo_descricao: r.getString('grupo_descricao'),
      descricao_grupo_tributario: r.getString('descricao_grupo_tributario'),
      segmento: r.getString('segmento'),
      comissao_padrao: r.getFloat('comissao_padrao'),
    }))

    const regras = regrasRecords.map((r) => ({
      id: r.id,
      id_regra: r.getString('id_regra'),
      uf_origem: r.getString('uf_origem'),
      uf_destino: r.getString('uf_destino'),
      aliquota_icms: r.getFloat('aliquota_icms'),
      reducao_base: r.getFloat('reducao_base'),
      aliquota_efetiva: r.getFloat('aliquota_efetiva'),
      diferimento: r.getBool('diferimento'),
      percentual_diferimento: r.getFloat('percentual_diferimento'),
      fundamentacao_legal: r.getString('fundamentacao_legal'),
      tipo_operacao: r.getString('tipo_operacao'),
      chave_origem_destino: r.getString('chave_origem_destino'),
      grupo_tributario_codigo: r.getString('grupo_tributario_codigo'),
      grupo_tributario_descricao: r.getString('grupo_tributario_descricao'),
      tipo_desonerado: r.getString('tipo_desonerado'),
      icms_desonerado: r.getFloat('icms_desonerado'),
      regra_credito_entrada: r.getString('regra_credito_entrada'),
      prod_importado: r.getString('prod_importado'),
    }))

    return e.json(200, {
      sucesso: true,
      totalProdutos: produtos.length,
      totalRegras: regras.length,
      produtos,
      regras,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha ao exportar dados: ' + (err.message || String(err)),
    })
  }
})

cronAdd('executar_auditoria_diagnostico', '* * * * *', () => {
  try {
    const colStatus = $app.findCollectionByNameOrId('simulador_parametrizacao_fiscal')
    const produtosRecords = $app.findRecordsByFilter('simulador_produtos', '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(
      'simulador_regras_icms',
      '',
      'uf_origem,uf_destino',
      10000,
      0,
    )

    console.log(
      '[AUDITORIA_CRON_V2_START] Produtos: ' +
        produtosRecords.length +
        ', Regras: ' +
        regrasRecords.length,
    )

    const mapaRegrasExatas = {}
    const mapaRegrasFallback = {}

    for (let i = 0; i < regrasRecords.length; i++) {
      const r = regrasRecords[i]
      const orig = (r.getString('uf_origem') || '').toUpperCase().trim()
      const dest = (r.getString('uf_destino') || '').toUpperCase().trim()
      const gr = (r.getString('grupo_tributario_codigo') || '').trim()

      const objRegra = {
        id: r.id,
        id_regra: r.getString('id_regra'),
        uf_origem: orig,
        uf_destino: dest,
        aliquota_icms: r.getFloat('aliquota_icms'),
        reducao_base: r.getFloat('reducao_base'),
        aliquota_efetiva: r.getFloat('aliquota_efetiva'),
        diferimento: r.getBool('diferimento'),
        percentual_diferimento: r.getFloat('percentual_diferimento'),
        tipo_desonerado: r.getString('tipo_desonerado'),
        icms_desonerado: r.getFloat('icms_desonerado'),
        regra_credito_entrada: r.getString('regra_credito_entrada'),
        grupo_tributario_codigo: gr,
      }

      if (gr) {
        const kExata = orig + '_' + dest + '_' + gr
        if (!mapaRegrasExatas[kExata]) mapaRegrasExatas[kExata] = objRegra
      }
      const kFb = orig + '_' + dest
      if (!mapaRegrasFallback[kFb]) mapaRegrasFallback[kFb] = objRegra
    }

    const rotas = [
      {
        nome: 'SP→MT (Compra) e MT→SP (Venda)',
        origC: 'SP',
        destC: 'MT',
        origV: 'MT',
        destV: 'SP',
      },
      {
        nome: 'SP→SP (Compra) e SP→SP (Venda) - Interna',
        origC: 'SP',
        destC: 'SP',
        origV: 'SP',
        destV: 'SP',
      },
      {
        nome: 'SP→MG (Compra) e MG→MG (Venda) - Estado Rico',
        origC: 'SP',
        destC: 'MG',
        origV: 'MG',
        destV: 'MG',
      },
    ]

    let totalExecucoes = 0
    let totalOk = 0
    let totalErrosCalculo = 0
    let totalSemRegra = 0

    const listaErros = []
    const resumoSemRegra = {}
    const contagemPorGrTrib = {}

    for (let pIdx = 0; pIdx < produtosRecords.length; pIdx++) {
      const p = produtosRecords[pIdx]
      const codigo = p.getString('codigo')
      const descricao = p.getString('descricao')
      let grTrib = (p.getString('gr_trib') || '').trim()
      if (grTrib.length > 0 && grTrib.length < 3) {
        grTrib = grTrib.padStart(3, '0')
      }
      const moeda = (p.getString('moeda') || 'BRL').toUpperCase()
      const comissaoPadrao = p.getFloat('comissao_padrao')
      const comissaoPerc =
        comissaoPadrao > 0 ? (comissaoPadrao < 1 ? comissaoPadrao * 100 : comissaoPadrao) : 2.5

      contagemPorGrTrib[grTrib || 'SEM_GR'] = (contagemPorGrTrib[grTrib || 'SEM_GR'] || 0) + 1

      for (let rIdx = 0; rIdx < rotas.length; rIdx++) {
        const rota = rotas[rIdx]
        totalExecucoes++

        const keyCExata = rota.origC + '_' + rota.destC + '_' + grTrib
        const keyCFallback = rota.origC + '_' + rota.destC
        const regraCompra =
          (grTrib && mapaRegrasExatas[keyCExata]) || mapaRegrasFallback[keyCFallback] || null

        const keyVExata = rota.origV + '_' + rota.destV + '_' + grTrib
        const keyVFallback = rota.origV + '_' + rota.destV
        const regraVenda =
          (grTrib && mapaRegrasExatas[keyVExata]) || mapaRegrasFallback[keyVFallback] || null

        const temRegra = regraCompra !== null && regraVenda !== null

        if (!temRegra) {
          totalSemRegra++
          const detalheFalta = !regraCompra
            ? 'Compra ' + rota.origC + '→' + rota.destC
            : 'Venda ' + rota.origV + '→' + rota.destV
          const chaveResumo =
            rota.nome + ' | GrTrib ' + (grTrib || 'SEM_GR') + ' (' + detalheFalta + ')'
          resumoSemRegra[chaveResumo] = (resumoSemRegra[chaveResumo] || 0) + 1
          continue
        }

        try {
          const precoUnitarioCompra = 100
          const ptax = moeda === 'USD' ? 5.75 : 1.0
          const precoUnitarioCompraReais = precoUnitarioCompra * ptax
          const volumeTotal = 1000
          const valorMercadoriaCompraReais = volumeTotal * precoUnitarioCompraReais
          const freteCompra = 1200
          const seguroCompra = 200
          const outrasCompra = 100
          const custoAquisicaoMercadoria =
            valorMercadoriaCompraReais + freteCompra + seguroCompra + outrasCompra

          let aliqCompra = 0
          if (
            regraCompra.aliquota_efetiva !== undefined &&
            regraCompra.aliquota_efetiva !== null &&
            regraCompra.aliquota_efetiva > 0
          ) {
            aliqCompra = regraCompra.aliquota_efetiva
          } else {
            aliqCompra = regraCompra.aliquota_icms || 0
          }
          const icmsCreditoValor = valorMercadoriaCompraReais * (aliqCompra / 100)
          const pisCreditoValor = custoAquisicaoMercadoria * 0.00165
          const cofinsCreditoValor = custoAquisicaoMercadoria * 0.0076
          const totalCreditos = icmsCreditoValor + pisCreditoValor + cofinsCreditoValor
          const custoLiquidoSemTributos = Math.max(0, custoAquisicaoMercadoria - totalCreditos)

          const jurosCompra = custoAquisicaoMercadoria * (((1.2 / 30) * 30) / 100)
          const custoTotalCompraComJuros = custoAquisicaoMercadoria + jurosCompra

          const precoUnitarioVendaReais = precoUnitarioCompraReais * 1.35
          const valorMercadoriaVendaReais = volumeTotal * precoUnitarioVendaReais
          const freteVenda = 2500
          const seguroVenda = 350
          const outrasVenda = 150
          const totalDespesasVenda = freteVenda + seguroVenda + outrasVenda
          const baseBrutaIcmsVenda =
            valorMercadoriaVendaReais + freteVenda + seguroVenda + outrasVenda
          const baseOperacaoComercial = valorMercadoriaVendaReais + totalDespesasVenda

          const redBase = regraVenda.reducao_base || 0
          const aliqNominal = regraVenda.aliquota_icms || 0
          const baseEfetivaIcms = baseBrutaIcmsVenda * (1 - redBase / 100)
          const debitoIcms = baseEfetivaIcms * (aliqNominal / 100)
          const diferimento = regraVenda.diferimento || regraVenda.percentual_diferimento > 0
          const percDif = regraVenda.percentual_diferimento || (diferimento ? 100 : 0)
          const valorDif = debitoIcms * (percDif / 100)
          const icmsEfetivo = Math.max(0, debitoIcms - valorDif)

          const basePisCofins = Math.max(0, baseOperacaoComercial - icmsEfetivo)
          const valorPis = basePisCofins * (0.165 / 100)
          const valorCofins = basePisCofins * (0.76 / 100)
          const valorIbs = baseOperacaoComercial * 0.4 * (0.1 / 100)
          const valorCbs = baseOperacaoComercial * 0.4 * (0.9 / 100)
          const totalTributosVenda = icmsEfetivo + valorPis + valorCofins + valorIbs + valorCbs

          const cargaEfetivaPerc =
            baseOperacaoComercial > 0 ? (totalTributosVenda / baseOperacaoComercial) * 100 : 0
          const comissaoValor = baseOperacaoComercial * (comissaoPerc / 100)
          const jurosVenda = baseOperacaoComercial * (((1.8 / 30) * 60) / 100)

          const receitaBruta = baseOperacaoComercial
          const receitaLiquida = receitaBruta - totalTributosVenda
          const custoAquisicaoBase =
            valorMercadoriaCompraReais + (freteCompra + seguroCompra + outrasCompra)
          const despesasVenda = freteVenda + seguroVenda + outrasVenda + comissaoValor
          const margemOperacional = receitaLiquida - custoAquisicaoBase - despesasVenda
          const resultadoFinal = margemOperacional + (jurosVenda - jurosCompra)

          const taxaEfetivaVendaPerc = (1.8 / 30) * 60
          const margemAlvo = 15
          const somaCargas = (cargaEfetivaPerc + comissaoPerc + taxaEfetivaVendaPerc) / 100
          const divisorBreakEven = Math.max(0.001, 1 - somaCargas)
          const breakEven = custoAquisicaoBase / divisorBreakEven
          const divisorMargem = Math.max(0.001, 1 - somaCargas - margemAlvo / 100)
          const precoSugerido =
            divisorMargem > 0
              ? custoAquisicaoBase / divisorMargem
              : breakEven * (1 + margemAlvo / 100)
          const markup = custoAquisicaoBase > 0 ? precoSugerido / custoAquisicaoBase : 1.0

          const checagens = [
            { k: 'custoAquisicaoMercadoria', v: custoAquisicaoMercadoria },
            { k: 'custoTotalCompraComJuros', v: custoTotalCompraComJuros },
            { k: 'receitaLiquida', v: receitaLiquida },
            { k: 'totalTributosVenda', v: totalTributosVenda },
            { k: 'resultadoFinal', v: resultadoFinal },
            { k: 'breakEven', v: breakEven },
            { k: 'precoSugerido', v: precoSugerido },
            { k: 'markup', v: markup },
          ]

          let hasError = false
          let motivo = ''
          for (let c = 0; c < checagens.length; c++) {
            const val = checagens[c].v
            if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
              hasError = true
              motivo = checagens[c].k + ' inválido: ' + val
              break
            }
          }

          if (precoSugerido <= 0 || breakEven <= 0 || markup <= 0) {
            hasError = true
            motivo =
              'Valores negativos ou zerados: precoSugerido=' +
              precoSugerido +
              ', breakEven=' +
              breakEven +
              ', markup=' +
              markup
          }

          if (hasError) {
            totalErrosCalculo++
            listaErros.push({
              codigo,
              descricao,
              rota: rota.nome,
              grTrib,
              moeda,
              motivo,
            })
          } else {
            totalOk++
          }
        } catch (calcErr) {
          totalErrosCalculo++
          listaErros.push({
            codigo,
            descricao,
            rota: rota.nome,
            grTrib,
            moeda,
            motivo: 'Exceção: ' + (calcErr.message || String(calcErr)),
          })
        }
      }
    }

    const resultadoPayload = {
      totalProdutos: produtosRecords.length,
      totalRotasPorProduto: rotas.length,
      totalExecucoes,
      totalOk,
      totalErrosCalculo,
      totalSemRegra,
      contagemPorGrTrib,
      resumoSemRegra,
      listaErrosTotal: listaErros.length,
      listaErros,
    }

    // Grava em simulador_parametrizacao_fiscal como cache
    try {
      let cacheRec = null
      try {
        cacheRec = $app.findFirstRecordByFilter(
          'simulador_parametrizacao_fiscal',
          "classificacao = 'AUDITORIA_CACHE'",
        )
      } catch (_) {}

      if (!cacheRec) {
        const col = $app.findCollectionByNameOrId('simulador_parametrizacao_fiscal')
        cacheRec = new Record(col)
        cacheRec.set('ncm', '9999.99.99')
        cacheRec.set('classificacao', 'AUDITORIA_CACHE')
      }
      cacheRec.set('tributacao', JSON.stringify(resultadoPayload))
      $app.save(cacheRec)
      console.log(
        '[AUDITORIA_CRON_V2_RESULT] ' +
          JSON.stringify({
            totalProdutos: resultadoPayload.totalProdutos,
            totalExecucoes: resultadoPayload.totalExecucoes,
            totalOk: resultadoPayload.totalOk,
            totalErrosCalculo: resultadoPayload.totalErrosCalculo,
            totalSemRegra: resultadoPayload.totalSemRegra,
            resumoSemRegra: resultadoPayload.resumoSemRegra,
          }),
      )
    } catch (saveErr) {
      console.error('[AUDITORIA_SAVE_ERR] ' + (saveErr.message || String(saveErr)))
    }
  } catch (e) {
    console.error('[AUDITORIA_CRON_ERROR] ' + (e.message || String(e)))
  }
})

routerAdd('GET', '/backend/v1/simulador/executar-auditoria-resultado', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter(
      'simulador_parametrizacao_fiscal',
      "classificacao = 'AUDITORIA_CACHE'",
    )
    if (rec) {
      return e.json(200, {
        sucesso: true,
        data: JSON.parse(rec.getString('tributacao')),
      })
    }
  } catch (_) {}
  return e.json(404, { sucesso: false, error: 'Aguardando cron' })
})

routerAdd('GET', '/backend/v1/simulador/exportar-dados-completos', (e) => {
  try {
    const colProdutos = $app.findCollectionByNameOrId('simulador_produtos')
    const colRegras = $app.findCollectionByNameOrId('simulador_regras_icms')

    const produtosRecords = $app.findRecordsByFilter(colProdutos, '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(colRegras, '', 'uf_origem,uf_destino', 10000, 0)

    const produtos = produtosRecords.map((r) => ({
      id: r.id,
      codigo: r.getString('codigo'),
      descricao: r.getString('descricao'),
      ncm: r.getString('ncm'),
      unidade: r.getString('unidade'),
      tipo_produto: r.getString('tipo_produto'),
      origem: r.getString('origem'),
      embalagem: r.getString('embalagem'),
      principio_ativo: r.getString('principio_ativo'),
      fabricante: r.getString('fabricante'),
      moeda: r.getString('moeda'),
      preco_base_sugerido: r.getFloat('preco_base_sugerido'),
      gr_trib: r.getString('gr_trib'),
      grupo_codigo: r.getString('grupo_codigo'),
      grupo_descricao: r.getString('grupo_descricao'),
      descricao_grupo_tributario: r.getString('descricao_grupo_tributario'),
      segmento: r.getString('segmento'),
      comissao_padrao: r.getFloat('comissao_padrao'),
    }))

    const regras = regrasRecords.map((r) => ({
      id: r.id,
      id_regra: r.getString('id_regra'),
      uf_origem: r.getString('uf_origem'),
      uf_destino: r.getString('uf_destino'),
      aliquota_icms: r.getFloat('aliquota_icms'),
      reducao_base: r.getFloat('reducao_base'),
      aliquota_efetiva: r.getFloat('aliquota_efetiva'),
      diferimento: r.getBool('diferimento'),
      percentual_diferimento: r.getFloat('percentual_diferimento'),
      fundamentacao_legal: r.getString('fundamentacao_legal'),
      tipo_operacao: r.getString('tipo_operacao'),
      chave_origem_destino: r.getString('chave_origem_destino'),
      grupo_tributario_codigo: r.getString('grupo_tributario_codigo'),
      grupo_tributario_descricao: r.getString('grupo_tributario_descricao'),
      tipo_desonerado: r.getString('tipo_desonerado'),
      icms_desonerado: r.getFloat('icms_desonerado'),
      regra_credito_entrada: r.getString('regra_credito_entrada'),
      prod_importado: r.getString('prod_importado'),
    }))

    return e.json(200, {
      sucesso: true,
      totalProdutos: produtos.length,
      totalRegras: regras.length,
      produtos,
      regras,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha ao exportar dados: ' + (err.message || String(err)),
    })
  }
})

routerAdd('GET', '/backend/v1/simulador/executar-auditoria-completa', (e) => {
  try {
    const produtosRecords = $app.findRecordsByFilter('simulador_produtos', '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(
      'simulador_regras_icms',
      '',
      'uf_origem,uf_destino',
      10000,
      0,
    )

    // Agrupa regras em memória para busca O(1)
    // chave: ufOrigem_ufDestino_grTrib e ufOrigem_ufDestino
    const mapaRegrasExatas = {}
    const mapaRegrasFallback = {}

    for (let i = 0; i < regrasRecords.length; i++) {
      const r = regrasRecords[i]
      const orig = (r.getString('uf_origem') || '').toUpperCase().trim()
      const dest = (r.getString('uf_destino') || '').toUpperCase().trim()
      const gr = (r.getString('grupo_tributario_codigo') || '').trim()

      const objRegra = {
        id: r.id,
        id_regra: r.getString('id_regra'),
        uf_origem: orig,
        uf_destino: dest,
        aliquota_icms: r.getFloat('aliquota_icms'),
        reducao_base: r.getFloat('reducao_base'),
        aliquota_efetiva: r.getFloat('aliquota_efetiva'),
        diferimento: r.getBool('diferimento'),
        percentual_diferimento: r.getFloat('percentual_diferimento'),
        tipo_desonerado: r.getString('tipo_desonerado'),
        icms_desonerado: r.getFloat('icms_desonerado'),
        regra_credito_entrada: r.getString('regra_credito_entrada'),
        grupo_tributario_codigo: gr,
      }

      if (gr) {
        const kExata = orig + '_' + dest + '_' + gr
        if (!mapaRegrasExatas[kExata]) mapaRegrasExatas[kExata] = objRegra
      }
      const kFb = orig + '_' + dest
      if (!mapaRegrasFallback[kFb]) mapaRegrasFallback[kFb] = objRegra
    }

    const rotas = [
      {
        nome: 'SP→MT (Compra) e MT→SP (Venda)',
        origC: 'SP',
        destC: 'MT',
        origV: 'MT',
        destV: 'SP',
      },
      {
        nome: 'SP→SP (Compra) e SP→SP (Venda) - Interna',
        origC: 'SP',
        destC: 'SP',
        origV: 'SP',
        destV: 'SP',
      },
      {
        nome: 'SP→MG (Compra) e MG→MG (Venda) - Estado Rico',
        origC: 'SP',
        destC: 'MG',
        origV: 'MG',
        destV: 'MG',
      },
    ]

    let totalExecucoes = 0
    let totalOk = 0
    let totalErrosCalculo = 0
    let totalSemRegra = 0

    const listaErros = []
    const resumoSemRegra = {} // { rota_GrTrib: count }
    const contagemPorGrTrib = {}

    for (let pIdx = 0; pIdx < produtosRecords.length; pIdx++) {
      const p = produtosRecords[pIdx]
      const codigo = p.getString('codigo')
      const descricao = p.getString('descricao')
      let grTrib = (p.getString('gr_trib') || '').trim()
      if (grTrib.length > 0 && grTrib.length < 3) {
        grTrib = grTrib.padStart(3, '0')
      }
      const moeda = (p.getString('moeda') || 'BRL').toUpperCase()
      const origem = p.getString('origem') || 'Nacional'
      const embalagem = p.getString('embalagem') || ''
      const comissaoPadrao = p.getFloat('comissao_padrao')
      const comissaoPerc =
        comissaoPadrao > 0 ? (comissaoPadrao < 1 ? comissaoPadrao * 100 : comissaoPadrao) : 2.5

      contagemPorGrTrib[grTrib || 'SEM_GR'] = (contagemPorGrTrib[grTrib || 'SEM_GR'] || 0) + 1

      for (let rIdx = 0; rIdx < rotas.length; rIdx++) {
        const rota = rotas[rIdx]
        totalExecucoes++

        const keyCExata = rota.origC + '_' + rota.destC + '_' + grTrib
        const keyCFallback = rota.origC + '_' + rota.destC
        const regraCompra =
          (grTrib && mapaRegrasExatas[keyCExata]) || mapaRegrasFallback[keyCFallback] || null

        const keyVExata = rota.origV + '_' + rota.destV + '_' + grTrib
        const keyVFallback = rota.origV + '_' + rota.destV
        const regraVenda =
          (grTrib && mapaRegrasExatas[keyVExata]) || mapaRegrasFallback[keyVFallback] || null

        const temRegra = regraCompra !== null && regraVenda !== null

        if (!temRegra) {
          totalSemRegra++
          const detalheFalta = !regraCompra
            ? 'Compra ' + rota.origC + '→' + rota.destC
            : 'Venda ' + rota.origV + '→' + rota.destV
          const chaveResumo =
            rota.nome + ' | GrTrib ' + (grTrib || 'SEM_GR') + ' (' + detalheFalta + ')'
          resumoSemRegra[chaveResumo] = (resumoSemRegra[chaveResumo] || 0) + 1
          continue
        }

        // Teste de cálculo com os parâmetros
        // 1. Simulação com PTAX padrão 5.75
        // 2. Simulação com PTAX não informada (1.0 / fallback)
        try {
          // Preço base R$ 100
          const precoUnitarioCompra = 100
          const ptax = moeda === 'USD' ? 5.75 : 1.0
          const precoUnitarioCompraReais = precoUnitarioCompra * ptax
          const volumeTotal = 1000
          const valorMercadoriaCompraReais = volumeTotal * precoUnitarioCompraReais
          const freteCompra = 1200
          const seguroCompra = 200
          const outrasCompra = 100
          const custoAquisicaoMercadoria =
            valorMercadoriaCompraReais + freteCompra + seguroCompra + outrasCompra

          // ICMS Compra
          let aliqCompra = 0
          if (
            regraCompra.aliquota_efetiva !== undefined &&
            regraCompra.aliquota_efetiva !== null &&
            regraCompra.aliquota_efetiva > 0
          ) {
            aliqCompra = regraCompra.aliquota_efetiva
          } else {
            aliqCompra = regraCompra.aliquota_icms || 0
          }
          const icmsCreditoValor = valorMercadoriaCompraReais * (aliqCompra / 100)
          const pisCreditoValor = custoAquisicaoMercadoria * 0.00165
          const cofinsCreditoValor = custoAquisicaoMercadoria * 0.0076
          const totalCreditos = icmsCreditoValor + pisCreditoValor + cofinsCreditoValor
          const custoLiquidoSemTributos = Math.max(0, custoAquisicaoMercadoria - totalCreditos)

          const jurosCompra = custoAquisicaoMercadoria * (((1.2 / 30) * 30) / 100)
          const custoTotalCompraComJuros = custoAquisicaoMercadoria + jurosCompra

          // Venda
          const precoUnitarioVendaReais = precoUnitarioCompraReais * 1.35
          const valorMercadoriaVendaReais = volumeTotal * precoUnitarioVendaReais
          const freteVenda = 2500
          const seguroVenda = 350
          const outrasVenda = 150
          const totalDespesasVenda = freteVenda + seguroVenda + outrasVenda
          const baseBrutaIcmsVenda =
            valorMercadoriaVendaReais + freteVenda + seguroVenda + outrasVenda
          const baseOperacaoComercial = valorMercadoriaVendaReais + totalDespesasVenda

          const redBase = regraVenda.reducao_base || 0
          const aliqNominal = regraVenda.aliquota_icms || 0
          const baseEfetivaIcms = baseBrutaIcmsVenda * (1 - redBase / 100)
          const debitoIcms = baseEfetivaIcms * (aliqNominal / 100)
          const diferimento = regraVenda.diferimento || regraVenda.percentual_diferimento > 0
          const percDif = regraVenda.percentual_diferimento || (diferimento ? 100 : 0)
          const valorDif = debitoIcms * (percDif / 100)
          const icmsEfetivo = Math.max(0, debitoIcms - valorDif)

          const basePisCofins = Math.max(0, baseOperacaoComercial - icmsEfetivo)
          const valorPis = basePisCofins * (0.165 / 100)
          const valorCofins = basePisCofins * (0.76 / 100)
          const valorIbs = baseOperacaoComercial * 0.4 * (0.1 / 100)
          const valorCbs = baseOperacaoComercial * 0.4 * (0.9 / 100)
          const totalTributosVenda = icmsEfetivo + valorPis + valorCofins + valorIbs + valorCbs

          const cargaEfetivaPerc =
            baseOperacaoComercial > 0 ? (totalTributosVenda / baseOperacaoComercial) * 100 : 0
          const comissaoValor = baseOperacaoComercial * (comissaoPerc / 100)
          const jurosVenda = baseOperacaoComercial * (((1.8 / 30) * 60) / 100)

          const receitaBruta = baseOperacaoComercial
          const receitaLiquida = receitaBruta - totalTributosVenda
          const custoAquisicaoBase =
            valorMercadoriaCompraReais + (freteCompra + seguroCompra + outrasCompra)
          const despesasVenda = freteVenda + seguroVenda + outrasVenda + comissaoValor
          const margemOperacional = receitaLiquida - custoAquisicaoBase - despesasVenda
          const resultadoFinal = margemOperacional + (jurosVenda - jurosCompra)

          // Markup
          const taxaEfetivaVendaPerc = (1.8 / 30) * 60
          const margemAlvo = 15
          const somaCargas = (cargaEfetivaPerc + comissaoPerc + taxaEfetivaVendaPerc) / 100
          const divisorBreakEven = Math.max(0.001, 1 - somaCargas)
          const breakEven = custoAquisicaoBase / divisorBreakEven
          const divisorMargem = Math.max(0.001, 1 - somaCargas - margemAlvo / 100)
          const precoSugerido =
            divisorMargem > 0
              ? custoAquisicaoBase / divisorMargem
              : breakEven * (1 + margemAlvo / 100)
          const markup = custoAquisicaoBase > 0 ? precoSugerido / custoAquisicaoBase : 1.0

          // Validações
          const checagens = [
            { k: 'custoAquisicaoMercadoria', v: custoAquisicaoMercadoria },
            { k: 'custoTotalCompraComJuros', v: custoTotalCompraComJuros },
            { k: 'receitaLiquida', v: receitaLiquida },
            { k: 'totalTributosVenda', v: totalTributosVenda },
            { k: 'resultadoFinal', v: resultadoFinal },
            { k: 'breakEven', v: breakEven },
            { k: 'precoSugerido', v: precoSugerido },
            { k: 'markup', v: markup },
          ]

          let hasError = false
          let motivo = ''
          for (let c = 0; c < checagens.length; c++) {
            const val = checagens[c].v
            if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
              hasError = true
              motivo = checagens[c].k + ' inválido: ' + val
              break
            }
          }

          if (precoSugerido <= 0 || breakEven <= 0 || markup <= 0) {
            hasError = true
            motivo =
              'Valores negativos ou zerados: precoSugerido=' +
              precoSugerido +
              ', breakEven=' +
              breakEven +
              ', markup=' +
              markup
          }

          if (hasError) {
            totalErrosCalculo++
            listaErros.push({
              codigo,
              descricao,
              rota: rota.nome,
              grTrib,
              moeda,
              motivo,
            })
          } else {
            totalOk++
          }
        } catch (calcErr) {
          totalErrosCalculo++
          listaErros.push({
            codigo,
            descricao,
            rota: rota.nome,
            grTrib,
            moeda,
            motivo: 'Exceção: ' + (calcErr.message || String(calcErr)),
          })
        }
      }
    }

    return e.json(200, {
      sucesso: true,
      totalProdutos: produtosRecords.length,
      totalRotasPorProduto: rotas.length,
      totalExecucoes,
      totalOk,
      totalErrosCalculo,
      totalSemRegra,
      contagemPorGrTrib,
      resumoSemRegra,
      listaErros,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha na auditoria: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/setup-admin', (e) => {
  const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const email = (data.email || 'admin@simulador.agro.com').toLowerCase().trim()
  const password = data.password || 'AdminAgro@2025!'
  const name = data.name || 'Administrador Simulador'

  try {
    const existing = $app.findAuthRecordByEmail('simulador_comercial_users', email)
    if (existing) {
      existing.set('role', 'admin')
      $app.save(existing)
      return e.json(200, {
        sucesso: true,
        mensagem: 'Usuário administrador já existia e teve papel admin garantido.',
        email: existing.getString('email'),
      })
    }
  } catch (_) {}

  const record = new Record(usersCol)
  record.set('email', email)
  record.set('password', password)
  record.set('name', name)
  record.set('role', 'admin')
  record.set('verified', true)
  $app.save(record)

  return e.json(200, {
    sucesso: true,
    mensagem: 'Primeiro administrador criado com sucesso!',
    email: record.getString('email'),
  })
})

routerAdd('GET', '/backend/v1/simulador/disparar-auditoria-manual', (e) => {
  try {
    const produtosRecords = $app.findRecordsByFilter('simulador_produtos', '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(
      'simulador_regras_icms',
      '',
      'uf_origem,uf_destino',
      10000,
      0,
    )

    const mapaRegrasExatas = {}
    const mapaRegrasFallback = {}

    for (let i = 0; i < regrasRecords.length; i++) {
      const r = regrasRecords[i]
      const orig = (r.getString('uf_origem') || '').toUpperCase().trim()
      const dest = (r.getString('uf_destino') || '').toUpperCase().trim()
      const gr = (r.getString('grupo_tributario_codigo') || '').trim()

      const objRegra = {
        id: r.id,
        id_regra: r.getString('id_regra'),
        uf_origem: orig,
        uf_destino: dest,
        aliquota_icms: r.getFloat('aliquota_icms'),
        reducao_base: r.getFloat('reducao_base'),
        aliquota_efetiva: r.getFloat('aliquota_efetiva'),
        diferimento: r.getBool('diferimento'),
        percentual_diferimento: r.getFloat('percentual_diferimento'),
        tipo_desonerado: r.getString('tipo_desonerado'),
        icms_desonerado: r.getFloat('icms_desonerado'),
        regra_credito_entrada: r.getString('regra_credito_entrada'),
        grupo_tributario_codigo: gr,
      }

      if (gr) {
        const kExata = orig + '_' + dest + '_' + gr
        if (!mapaRegrasExatas[kExata]) mapaRegrasExatas[kExata] = objRegra
      }
      const kFb = orig + '_' + dest
      if (!mapaRegrasFallback[kFb]) mapaRegrasFallback[kFb] = objRegra
    }

    const rotas = [
      {
        nome: 'SP→MT (Compra) e MT→SP (Venda)',
        origC: 'SP',
        destC: 'MT',
        origV: 'MT',
        destV: 'SP',
      },
      {
        nome: 'SP→SP (Compra) e SP→SP (Venda) - Interna',
        origC: 'SP',
        destC: 'SP',
        origV: 'SP',
        destV: 'SP',
      },
      {
        nome: 'SP→MG (Compra) e MG→MG (Venda) - Estado Rico',
        origC: 'SP',
        destC: 'MG',
        origV: 'MG',
        destV: 'MG',
      },
    ]

    let totalExecucoes = 0
    let totalOk = 0
    let totalErrosCalculo = 0
    let totalSemRegra = 0

    const listaErros = []
    const resumoSemRegra = {}
    const contagemPorGrTrib = {}

    for (let pIdx = 0; pIdx < produtosRecords.length; pIdx++) {
      const p = produtosRecords[pIdx]
      const codigo = p.getString('codigo')
      const descricao = p.getString('descricao')
      let grTrib = (p.getString('gr_trib') || '').trim()
      if (grTrib.length > 0 && grTrib.length < 3) {
        grTrib = grTrib.padStart(3, '0')
      }
      const moeda = (p.getString('moeda') || 'BRL').toUpperCase()
      const comissaoPadrao = p.getFloat('comissao_padrao')
      const comissaoPerc =
        comissaoPadrao > 0 ? (comissaoPadrao < 1 ? comissaoPadrao * 100 : comissaoPadrao) : 2.5

      contagemPorGrTrib[grTrib || 'SEM_GR'] = (contagemPorGrTrib[grTrib || 'SEM_GR'] || 0) + 1

      for (let rIdx = 0; rIdx < rotas.length; rIdx++) {
        const rota = rotas[rIdx]
        totalExecucoes++

        const keyCExata = rota.origC + '_' + rota.destC + '_' + grTrib
        const keyCFallback = rota.origC + '_' + rota.destC
        const regraCompra =
          (grTrib && mapaRegrasExatas[keyCExata]) || mapaRegrasFallback[keyCFallback] || null

        const keyVExata = rota.origV + '_' + rota.destV + '_' + grTrib
        const keyVFallback = rota.origV + '_' + rota.destV
        const regraVenda =
          (grTrib && mapaRegrasExatas[keyVExata]) || mapaRegrasFallback[keyVFallback] || null

        const temRegra = regraCompra !== null && regraVenda !== null

        if (!temRegra) {
          totalSemRegra++
          const detalheFalta = !regraCompra
            ? 'Compra ' + rota.origC + '→' + rota.destC
            : 'Venda ' + rota.origV + '→' + rota.destV
          const chaveResumo =
            rota.nome + ' | GrTrib ' + (grTrib || 'SEM_GR') + ' (' + detalheFalta + ')'
          resumoSemRegra[chaveResumo] = (resumoSemRegra[chaveResumo] || 0) + 1
          continue
        }

        try {
          const precoUnitarioCompra = 100
          const ptax = moeda === 'USD' ? 5.75 : 1.0
          const precoUnitarioCompraReais = precoUnitarioCompra * ptax
          const volumeTotal = 1000
          const valorMercadoriaCompraReais = volumeTotal * precoUnitarioCompraReais
          const freteCompra = 1200
          const seguroCompra = 200
          const outrasCompra = 100
          const custoAquisicaoMercadoria =
            valorMercadoriaCompraReais + freteCompra + seguroCompra + outrasCompra

          let aliqCompra = 0
          if (
            regraCompra.aliquota_efetiva !== undefined &&
            regraCompra.aliquota_efetiva !== null &&
            regraCompra.aliquota_efetiva > 0
          ) {
            aliqCompra = regraCompra.aliquota_efetiva
          } else {
            aliqCompra = regraCompra.aliquota_icms || 0
          }
          const icmsCreditoValor = valorMercadoriaCompraReais * (aliqCompra / 100)
          const pisCreditoValor = custoAquisicaoMercadoria * 0.00165
          const cofinsCreditoValor = custoAquisicaoMercadoria * 0.0076
          const totalCreditos = icmsCreditoValor + pisCreditoValor + cofinsCreditoValor

          const jurosCompra = custoAquisicaoMercadoria * (((1.2 / 30) * 30) / 100)
          const custoTotalCompraComJuros = custoAquisicaoMercadoria + jurosCompra

          const precoUnitarioVendaReais = precoUnitarioCompraReais * 1.35
          const valorMercadoriaVendaReais = volumeTotal * precoUnitarioVendaReais
          const freteVenda = 2500
          const seguroVenda = 350
          const outrasVenda = 150
          const totalDespesasVenda = freteVenda + seguroVenda + outrasVenda
          const baseBrutaIcmsVenda =
            valorMercadoriaVendaReais + freteVenda + seguroVenda + outrasVenda
          const baseOperacaoComercial = valorMercadoriaVendaReais + totalDespesasVenda

          const redBase = regraVenda.reducao_base || 0
          const aliqNominal = regraVenda.aliquota_icms || 0
          const baseEfetivaIcms = baseBrutaIcmsVenda * (1 - redBase / 100)
          const debitoIcms = baseEfetivaIcms * (aliqNominal / 100)
          const diferimento = regraVenda.diferimento || regraVenda.percentual_diferimento > 0
          const percDif = regraVenda.percentual_diferimento || (diferimento ? 100 : 0)
          const valorDif = debitoIcms * (percDif / 100)
          const icmsEfetivo = Math.max(0, debitoIcms - valorDif)

          const basePisCofins = Math.max(0, baseOperacaoComercial - icmsEfetivo)
          const valorPis = basePisCofins * (0.165 / 100)
          const valorCofins = basePisCofins * (0.76 / 100)
          const valorIbs = baseOperacaoComercial * 0.4 * (0.1 / 100)
          const valorCbs = baseOperacaoComercial * 0.4 * (0.9 / 100)
          const totalTributosVenda = icmsEfetivo + valorPis + valorCofins + valorIbs + valorCbs

          const cargaEfetivaPerc =
            baseOperacaoComercial > 0 ? (totalTributosVenda / baseOperacaoComercial) * 100 : 0
          const comissaoValor = baseOperacaoComercial * (comissaoPerc / 100)
          const jurosVenda = baseOperacaoComercial * (((1.8 / 30) * 60) / 100)

          const receitaBruta = baseOperacaoComercial
          const receitaLiquida = receitaBruta - totalTributosVenda
          const custoAquisicaoBase =
            valorMercadoriaCompraReais + (freteCompra + seguroCompra + outrasCompra)
          const despesasVenda = freteVenda + seguroVenda + outrasVenda + comissaoValor
          const margemOperacional = receitaLiquida - custoAquisicaoBase - despesasVenda
          const resultadoFinal = margemOperacional + (jurosVenda - jurosCompra)

          const taxaEfetivaVendaPerc = (1.8 / 30) * 60
          const margemAlvo = 15
          const somaCargas = (cargaEfetivaPerc + comissaoPerc + taxaEfetivaVendaPerc) / 100
          const divisorBreakEven = Math.max(0.001, 1 - somaCargas)
          const breakEven = custoAquisicaoBase / divisorBreakEven
          const divisorMargem = Math.max(0.001, 1 - somaCargas - margemAlvo / 100)
          const precoSugerido =
            divisorMargem > 0
              ? custoAquisicaoBase / divisorMargem
              : breakEven * (1 + margemAlvo / 100)
          const markup = custoAquisicaoBase > 0 ? precoSugerido / custoAquisicaoBase : 1.0

          const checagens = [
            { k: 'custoAquisicaoMercadoria', v: custoAquisicaoMercadoria },
            { k: 'custoTotalCompraComJuros', v: custoTotalCompraComJuros },
            { k: 'receitaLiquida', v: receitaLiquida },
            { k: 'totalTributosVenda', v: totalTributosVenda },
            { k: 'resultadoFinal', v: resultadoFinal },
            { k: 'breakEven', v: breakEven },
            { k: 'precoSugerido', v: precoSugerido },
            { k: 'markup', v: markup },
          ]

          let hasError = false
          let motivo = ''
          for (let c = 0; c < checagens.length; c++) {
            const val = checagens[c].v
            if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
              hasError = true
              motivo = checagens[c].k + ' inválido: ' + val
              break
            }
          }

          if (precoSugerido <= 0 || breakEven <= 0 || markup <= 0) {
            hasError = true
            motivo =
              'Valores negativos ou zerados: precoSugerido=' +
              precoSugerido +
              ', breakEven=' +
              breakEven +
              ', markup=' +
              markup
          }

          if (hasError) {
            totalErrosCalculo++
            listaErros.push({
              codigo,
              descricao,
              rota: rota.nome,
              grTrib,
              moeda,
              motivo,
            })
          } else {
            totalOk++
          }
        } catch (calcErr) {
          totalErrosCalculo++
          listaErros.push({
            codigo,
            descricao,
            rota: rota.nome,
            grTrib,
            moeda,
            motivo: 'Exceção: ' + (calcErr.message || String(calcErr)),
          })
        }
      }
    }

    const col = $app.findCollectionByNameOrId('convites_simulador')
    let recConvite = null
    try {
      recConvite = $app.findFirstRecordByFilter(
        'convites_simulador',
        "status = 'auditoria_resultado'",
      )
    } catch (_) {}

    if (!recConvite) {
      recConvite = new Record(col)
      recConvite.set('email', 'auditoria@simulador.local')
      recConvite.set('nome', 'Resultado Auditoria')
      recConvite.set('role', 'admin')
      recConvite.set('status', 'auditoria_resultado')
      recConvite.set('token_convite', 'auditoria_token')
    }

    const payloadString = JSON.stringify({
      totalProdutos: produtosRecords.length,
      totalRotasPorProduto: rotas.length,
      totalExecucoes,
      totalOk,
      totalErrosCalculo,
      totalSemRegra,
      contagemPorGrTrib,
      resumoSemRegra,
      listaErros,
    })

    recConvite.set('link_definicao_senha', payloadString)
    $app.save(recConvite)

    return e.json(200, {
      sucesso: true,
      mensagem: 'Auditoria executada e gravada com sucesso!',
      resultado: JSON.parse(payloadString),
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Erro na auditoria manual: ' + (err.message || String(err)),
    })
  }
})

routerAdd('GET', '/backend/v1/simulador/diagnostico-massa', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Acesso restrito ao Simulador Comercial.' })
  }

  try {
    const produtosRecords = $app.findRecordsByFilter('simulador_produtos', '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(
      'simulador_regras_icms',
      '',
      'uf_origem,uf_destino',
      10000,
      0,
    )

    const mapaRegrasExatas = {}
    const mapaRegrasFallback = {}

    for (let i = 0; i < regrasRecords.length; i++) {
      const r = regrasRecords[i]
      const orig = (r.getString('uf_origem') || '').toUpperCase().trim()
      const dest = (r.getString('uf_destino') || '').toUpperCase().trim()
      const gr = (r.getString('grupo_tributario_codigo') || '').trim()

      const objRegra = {
        id: r.id,
        id_regra: r.getString('id_regra'),
        uf_origem: orig,
        uf_destino: dest,
        aliquota_icms: r.getFloat('aliquota_icms'),
        reducao_base: r.getFloat('reducao_base'),
        aliquota_efetiva: r.getFloat('aliquota_efetiva'),
        diferimento: r.getBool('diferimento'),
        percentual_diferimento: r.getFloat('percentual_diferimento'),
        tipo_desonerado: r.getString('tipo_desonerado'),
        icms_desonerado: r.getFloat('icms_desonerado'),
        regra_credito_entrada: r.getString('regra_credito_entrada'),
        grupo_tributario_codigo: gr,
      }

      if (gr) {
        const kExata = orig + '_' + dest + '_' + gr
        if (!mapaRegrasExatas[kExata]) mapaRegrasExatas[kExata] = objRegra
      }
      const kFb = orig + '_' + dest
      if (!mapaRegrasFallback[kFb]) mapaRegrasFallback[kFb] = objRegra
    }

    const rotas = [
      {
        nome: 'SP→MT (Compra) e MT→SP (Venda)',
        origC: 'SP',
        destC: 'MT',
        origV: 'MT',
        destV: 'SP',
      },
      {
        nome: 'SP→SP (Compra) e SP→SP (Venda) - Interna',
        origC: 'SP',
        destC: 'SP',
        origV: 'SP',
        destV: 'SP',
      },
      {
        nome: 'SP→MG (Compra) e MG→MG (Venda) - Estado Rico',
        origC: 'SP',
        destC: 'MG',
        origV: 'MG',
        destV: 'MG',
      },
    ]

    let totalExecucoes = 0
    let totalOk = 0
    let totalErrosCalculo = 0
    let totalSemRegra = 0

    const listaErros = []
    const resumoSemRegra = {}
    const contagemPorGrTrib = {}

    for (let pIdx = 0; pIdx < produtosRecords.length; pIdx++) {
      const p = produtosRecords[pIdx]
      const codigo = p.getString('codigo')
      const descricao = p.getString('descricao')
      let grTrib = (p.getString('gr_trib') || '').trim()
      if (grTrib.length > 0 && grTrib.length < 3) {
        grTrib = grTrib.padStart(3, '0')
      }
      const moeda = (p.getString('moeda') || 'BRL').toUpperCase()
      const comissaoPadrao = p.getFloat('comissao_padrao')
      const comissaoPerc =
        comissaoPadrao > 0 ? (comissaoPadrao < 1 ? comissaoPadrao * 100 : comissaoPadrao) : 2.5

      contagemPorGrTrib[grTrib || 'SEM_GR'] = (contagemPorGrTrib[grTrib || 'SEM_GR'] || 0) + 1

      for (let rIdx = 0; rIdx < rotas.length; rIdx++) {
        const rota = rotas[rIdx]
        totalExecucoes++

        const keyCExata = rota.origC + '_' + rota.destC + '_' + grTrib
        const keyCFallback = rota.origC + '_' + rota.destC
        const regraCompra =
          (grTrib && mapaRegrasExatas[keyCExata]) || mapaRegrasFallback[keyCFallback] || null

        const keyVExata = rota.origV + '_' + rota.destV + '_' + grTrib
        const keyVFallback = rota.origV + '_' + rota.destV
        const regraVenda =
          (grTrib && mapaRegrasExatas[keyVExata]) || mapaRegrasFallback[keyVFallback] || null

        const temRegra = regraCompra !== null && regraVenda !== null

        if (!temRegra) {
          totalSemRegra++
          const detalheFalta = !regraCompra
            ? 'Compra ' + rota.origC + '→' + rota.destC
            : 'Venda ' + rota.origV + '→' + rota.destV
          const chaveResumo =
            rota.nome + ' | GrTrib ' + (grTrib || 'SEM_GR') + ' (' + detalheFalta + ')'
          resumoSemRegra[chaveResumo] = (resumoSemRegra[chaveResumo] || 0) + 1
          continue
        }

        try {
          const precoUnitarioCompra = 100
          const ptax = moeda === 'USD' ? 5.75 : 1.0
          const precoUnitarioCompraReais = precoUnitarioCompra * ptax
          const volumeTotal = 1000
          const valorMercadoriaCompraReais = volumeTotal * precoUnitarioCompraReais
          const freteCompra = 1200
          const seguroCompra = 200
          const outrasCompra = 100
          const custoAquisicaoMercadoria =
            valorMercadoriaCompraReais + freteCompra + seguroCompra + outrasCompra

          let aliqCompra = 0
          if (
            regraCompra.aliquota_efetiva !== undefined &&
            regraCompra.aliquota_efetiva !== null &&
            regraCompra.aliquota_efetiva > 0
          ) {
            aliqCompra = regraCompra.aliquota_efetiva
          } else {
            aliqCompra = regraCompra.aliquota_icms || 0
          }
          const icmsCreditoValor = valorMercadoriaCompraReais * (aliqCompra / 100)
          const pisCreditoValor = custoAquisicaoMercadoria * 0.00165
          const cofinsCreditoValor = custoAquisicaoMercadoria * 0.0076
          const totalCreditos = icmsCreditoValor + pisCreditoValor + cofinsCreditoValor

          const jurosCompra = custoAquisicaoMercadoria * (((1.2 / 30) * 30) / 100)
          const custoTotalCompraComJuros = custoAquisicaoMercadoria + jurosCompra

          const precoUnitarioVendaReais = precoUnitarioCompraReais * 1.35
          const valorMercadoriaVendaReais = volumeTotal * precoUnitarioVendaReais
          const freteVenda = 2500
          const seguroVenda = 350
          const outrasVenda = 150
          const totalDespesasVenda = freteVenda + seguroVenda + outrasVenda
          const baseBrutaIcmsVenda =
            valorMercadoriaVendaReais + freteVenda + seguroVenda + outrasVenda
          const baseOperacaoComercial = valorMercadoriaVendaReais + totalDespesasVenda

          const redBase = regraVenda.reducao_base || 0
          const aliqNominal = regraVenda.aliquota_icms || 0
          const baseEfetivaIcms = baseBrutaIcmsVenda * (1 - redBase / 100)
          const debitoIcms = baseEfetivaIcms * (aliqNominal / 100)
          const diferimento = regraVenda.diferimento || regraVenda.percentual_diferimento > 0
          const percDif = regraVenda.percentual_diferimento || (diferimento ? 100 : 0)
          const valorDif = debitoIcms * (percDif / 100)
          const icmsEfetivo = Math.max(0, debitoIcms - valorDif)

          const basePisCofins = Math.max(0, baseOperacaoComercial - icmsEfetivo)
          const valorPis = basePisCofins * (0.165 / 100)
          const valorCofins = basePisCofins * (0.76 / 100)
          const valorIbs = baseOperacaoComercial * 0.4 * (0.1 / 100)
          const valorCbs = baseOperacaoComercial * 0.4 * (0.9 / 100)
          const totalTributosVenda = icmsEfetivo + valorPis + valorCofins + valorIbs + valorCbs

          const cargaEfetivaPerc =
            baseOperacaoComercial > 0 ? (totalTributosVenda / baseOperacaoComercial) * 100 : 0
          const comissaoValor = baseOperacaoComercial * (comissaoPerc / 100)
          const jurosVenda = baseOperacaoComercial * (((1.8 / 30) * 60) / 100)

          const receitaBruta = baseOperacaoComercial
          const receitaLiquida = receitaBruta - totalTributosVenda
          const custoAquisicaoBase =
            valorMercadoriaCompraReais + (freteCompra + seguroCompra + outrasCompra)
          const despesasVenda = freteVenda + seguroVenda + outrasVenda + comissaoValor
          const margemOperacional = receitaLiquida - custoAquisicaoBase - despesasVenda
          const resultadoFinal = margemOperacional + (jurosVenda - jurosCompra)

          const taxaEfetivaVendaPerc = (1.8 / 30) * 60
          const margemAlvo = 15
          const somaCargas = (cargaEfetivaPerc + comissaoPerc + taxaEfetivaVendaPerc) / 100
          const divisorBreakEven = Math.max(0.001, 1 - somaCargas)
          const breakEven = custoAquisicaoBase / divisorBreakEven
          const divisorMargem = Math.max(0.001, 1 - somaCargas - margemAlvo / 100)
          const precoSugerido =
            divisorMargem > 0
              ? custoAquisicaoBase / divisorMargem
              : breakEven * (1 + margemAlvo / 100)
          const markup = custoAquisicaoBase > 0 ? precoSugerido / custoAquisicaoBase : 1.0

          const checagens = [
            { k: 'custoAquisicaoMercadoria', v: custoAquisicaoMercadoria },
            { k: 'custoTotalCompraComJuros', v: custoTotalCompraComJuros },
            { k: 'receitaLiquida', v: receitaLiquida },
            { k: 'totalTributosVenda', v: totalTributosVenda },
            { k: 'resultadoFinal', v: resultadoFinal },
            { k: 'breakEven', v: breakEven },
            { k: 'precoSugerido', v: precoSugerido },
            { k: 'markup', v: markup },
          ]

          let hasError = false
          let motivo = ''
          for (let c = 0; c < checagens.length; c++) {
            const val = checagens[c].v
            if (val === undefined || val === null || isNaN(val) || !isFinite(val)) {
              hasError = true
              motivo = checagens[c].k + ' inválido: ' + val
              break
            }
          }

          if (precoSugerido <= 0 || breakEven <= 0 || markup <= 0) {
            hasError = true
            motivo =
              'Valores negativos ou zerados: precoSugerido=' +
              precoSugerido +
              ', breakEven=' +
              breakEven +
              ', markup=' +
              markup
          }

          if (hasError) {
            totalErrosCalculo++
            listaErros.push({
              codigo,
              descricao,
              rota: rota.nome,
              grTrib,
              moeda,
              motivo,
            })
          } else {
            totalOk++
          }
        } catch (calcErr) {
          totalErrosCalculo++
          listaErros.push({
            codigo,
            descricao,
            rota: rota.nome,
            grTrib,
            moeda,
            motivo: 'Exceção: ' + (calcErr.message || String(calcErr)),
          })
        }
      }
    }

    return e.json(200, {
      sucesso: true,
      tipo: 'auditoria_produtos',
      totalProdutos: produtosRecords.length,
      totalRotasPorProduto: rotas.length,
      totalExecucoes,
      totalOk,
      totalErrosCalculo,
      totalSemRegra,
      contagemPorGrTrib,
      resumoSemRegra,
      listaErros,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Erro na auditoria: ' + (err.message || String(err)),
    })
  }
})

routerAdd('GET', '/backend/v1/simulador/usuarios', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Acesso restrito ao Simulador Comercial.' })
  }

  try {
    const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
    const userRecords = $app.findRecordsByFilter(usersCol, '', '-created', 100, 0)

    const usuarios = userRecords.map((r) => ({
      id: r.id,
      name: r.getString('name'),
      email: r.getString('email'),
      role: r.getString('role') || 'analista',
      verified: r.getBool('verified'),
      created: r.getString('created'),
      updated: r.getString('updated'),
    }))

    const convitesCol = $app.findCollectionByNameOrId('convites_simulador')
    const conviteRecords = $app.findRecordsByFilter(
      convitesCol,
      "status = 'pendente'",
      '-created',
      100,
      0,
    )

    const convites = conviteRecords.map((cRecord) => ({
      id: cRecord.id,
      email: cRecord.getString('email'),
      nome: cRecord.getString('nome'),
      role: cRecord.getString('role') || 'analista',
      status: cRecord.getString('status') || 'pendente',
      token_convite: cRecord.getString('token_convite'),
      link_definicao_senha: cRecord.getString('link_definicao_senha'),
      convidado_por: cRecord.getString('convidado_por'),
      created: cRecord.getString('created'),
    }))

    return e.json(200, {
      sucesso: true,
      usuarios,
      convites,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha ao listar usuários do simulador: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/usuarios/convidar', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Autenticação requerida.' })
  }

  const roleAuth = authRecord.getString('role')
  if (roleAuth !== 'admin') {
    return e.json(403, { sucesso: false, error: 'Apenas administradores podem convidar usuários.' })
  }

  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const email = (data.email || '').toLowerCase().trim()
  const nome = (data.nome || '').trim()
  const role = data.role === 'admin' ? 'admin' : 'analista'

  if (!email || email.indexOf('@') === -1) {
    return e.json(400, { sucesso: false, error: 'E-mail corporativo válido é obrigatório.' })
  }

  try {
    const existing = $app.findAuthRecordByEmail('simulador_comercial_users', email)
    if (existing) {
      return e.json(400, {
        sucesso: false,
        error: 'Este usuário já possui cadastro ativo no Simulador Comercial.',
      })
    }
  } catch (_) {}

  const senhaTemporaria = 'Agro@' + $security.randomString(8) + '!'
  const tokenConvite = $security.randomString(32)

  try {
    const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
    const novoUsuario = new Record(usersCol)
    novoUsuario.set('email', email)
    novoUsuario.set('password', senhaTemporaria)
    novoUsuario.set('name', nome || email.split('@')[0])
    novoUsuario.set('role', role)
    novoUsuario.set('verified', false)
    $app.save(novoUsuario)

    const convitesCol = $app.findCollectionByNameOrId('convites_simulador')
    const conviteRecord = new Record(convitesCol)
    conviteRecord.set('email', email)
    conviteRecord.set('nome', nome)
    conviteRecord.set('role', role)
    conviteRecord.set('status', 'pendente')
    conviteRecord.set('token_convite', tokenConvite)
    conviteRecord.set('link_definicao_senha', '/reset-password?token=' + tokenConvite)
    conviteRecord.set('convidado_por', authRecord.getString('email'))
    $app.save(conviteRecord)

    return e.json(200, {
      sucesso: true,
      mensagem: 'Convite registrado com sucesso para ' + email + '.',
      email_enviado: false,
      aviso_email: 'Utilize o link de primeiro acesso ou as credenciais temporárias.',
      usuario_id: novoUsuario.id,
      email: email,
      role: role,
      senha_temporaria: senhaTemporaria,
      link_primeiro_acesso: '/login?email=' + encodeURIComponent(email),
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha ao processar convite: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/usuarios/alterar-papel', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Autenticação requerida.' })
  }

  if (authRecord.getString('role') !== 'admin') {
    return e.json(403, { sucesso: false, error: 'Apenas administradores podem alterar papéis.' })
  }

  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const targetId = data.id
  const newRole = data.role === 'admin' ? 'admin' : 'analista'

  if (!targetId) {
    return e.json(400, { sucesso: false, error: 'ID do usuário não fornecido.' })
  }

  if (targetId === authRecord.id) {
    return e.json(400, { sucesso: false, error: 'Você não pode alterar seu próprio papel.' })
  }

  try {
    const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
    const target = $app.findRecordById(usersCol, targetId)
    target.set('role', newRole)
    $app.save(target)

    return e.json(200, {
      sucesso: true,
      mensagem:
        'Papel do usuário atualizado para ' +
        (newRole === 'admin' ? 'Administrador' : 'Analista') +
        '.',
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Erro ao atualizar papel: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/usuarios/excluir', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Autenticação requerida.' })
  }

  if (authRecord.getString('role') !== 'admin') {
    return e.json(403, {
      sucesso: false,
      error: 'Apenas administradores podem excluir usuários ou convites.',
    })
  }

  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const userId = data.id
  const conviteId = data.convite_id

  try {
    if (conviteId) {
      const convitesCol = $app.findCollectionByNameOrId('convites_simulador')
      const conviteRecord = $app.findRecordById(convitesCol, conviteId)
      $app.delete(conviteRecord)
      return e.json(200, { sucesso: true, mensagem: 'Convite cancelado e removido.' })
    }

    if (userId) {
      if (userId === authRecord.id) {
        return e.json(400, {
          sucesso: false,
          error: 'Não é permitido excluir sua própria conta logada.',
        })
      }
      const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
      const targetUser = $app.findRecordById(usersCol, userId)
      $app.delete(targetUser)
      return e.json(200, { sucesso: true, mensagem: 'Usuário removido do sistema.' })
    }

    return e.json(400, { sucesso: false, error: 'Nenhum ID informado para exclusão.' })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha na exclusão: ' + (err.message || String(err)),
    })
  }
})
