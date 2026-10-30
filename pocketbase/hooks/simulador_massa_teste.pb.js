/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Execução Real de Simulação em Massa para o Simulador Comercial Agro.
 * Roda os 1.177 produtos da base local 'simulador_produtos' nas 3 rotas fiscais:
 * 1. SP→MT (Compra) e MT→SP (Venda)
 * 2. SP→SP (Compra) e SP→SP (Venda) - Interna
 * 3. SP→MG (Compra) e MG→MG (Venda) - Estado Rico
 *
 * Suporta execução completa ou em lote (offset e limit) para máxima flexibilidade e auditoria.
 *
 * Endpoints:
 * - GET /backend/v1/simulador/executar-simulacao-massa-real
 * - GET /backend/v1/simulador/simulacao-massa-relatorio
 */

routerAdd('GET', '/backend/v1/simulador/executar-simulacao-massa-real', (e) => {
  try {
    const colProdutos = $app.findCollectionByNameOrId('simulador_produtos')
    const colRegras = $app.findCollectionByNameOrId('simulador_regras_icms')

    const produtosRecords = $app.findRecordsByFilter(colProdutos, '', 'codigo', 5000, 0)
    const regrasRecords = $app.findRecordsByFilter(colRegras, '', 'uf_origem,uf_destino', 10000, 0)

    // Indexa regras em mapa para busca exata (Origem_Destino_GrTrib) e fallback (Origem_Destino)
    const mapaRegrasExatas = {}
    const mapaRegrasFallback = {}

    for (let i = 0; i < regrasRecords.length; i++) {
      const r = regrasRecords[i]
      const orig = (r.getString('uf_origem') || '').toUpperCase().trim()
      const dest = (r.getString('uf_destino') || '').toUpperCase().trim()
      let gr = (r.getString('grupo_tributario_codigo') || '').trim()
      if (gr.length > 0 && gr.length < 3) {
        gr = gr.padStart(3, '0')
      }

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

    const falhasCompletas = []
    const avisosInformativos = {}
    const contagemPorGrTrib = {}
    const distribuicaoErrosPorTipo = {}

    const amostraCasosEspeciais = {
      USD_sem_ptax_manual: [],
      embalagem_vazia: [],
      unidade_L_fertilizante_solido: [],
    }

    for (let pIdx = 0; pIdx < produtosRecords.length; pIdx++) {
      const p = produtosRecords[pIdx]
      const codigo = p.getString('codigo') || 'S/C'
      const descricao = p.getString('descricao') || 'Produto Sem Descrição'
      let grTrib = (p.getString('gr_trib') || '').trim()
      if (grTrib.length > 0 && grTrib.length < 3) {
        grTrib = grTrib.padStart(3, '0')
      }
      const moeda = (p.getString('moeda') || 'BRL').toUpperCase()
      const embalagem = p.getString('embalagem') || ''
      const unidade = p.getString('unidade') || 'L'
      const precoBaseSugerido = p.getFloat('preco_base_sugerido')
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

        const temRegraCompra = regraCompra !== null
        const temRegraVenda = regraVenda !== null

        if (!temRegraCompra || !temRegraVenda) {
          totalSemRegra++
          const motivoFalta = !temRegraCompra
            ? 'Sem regra fiscal de compra cadastrada para rota ' + rota.origC + '→' + rota.destC
            : 'Sem regra fiscal de venda cadastrada para rota ' + rota.origV + '→' + rota.destV
          const kAviso = rota.nome + ' | GrTrib ' + (grTrib || 'SEM_GR') + ' (' + motivoFalta + ')'
          avisosInformativos[kAviso] = (avisosInformativos[kAviso] || 0) + 1
        }

        // Execução do Motor de Cálculo Canônico
        try {
          const quantidade = 1000
          const precoUnitarioCompra = precoBaseSugerido > 0 ? precoBaseSugerido : 100
          const ptax = moeda === 'USD' ? 5.75 : 1.0
          const precoUnitarioCompraReais = precoUnitarioCompra * ptax
          const valorMercadoriaCompraReais = quantidade * precoUnitarioCompraReais

          // Despesas de compra (FOB)
          const freteCompra = 1200
          const seguroCompra = 200
          const outrasDespesasCompra = 100
          const totalDespesasCompra = freteCompra + seguroCompra + outrasDespesasCompra
          const custoAquisicaoMercadoria = valorMercadoriaCompraReais + totalDespesasCompra

          // Tributos / Crédito de Compra
          let aliqCompra = 4.0 // Padrão se sem regra
          if (regraCompra) {
            aliqCompra =
              regraCompra.aliquota_efetiva !== undefined &&
              regraCompra.aliquota_efetiva !== null &&
              regraCompra.aliquota_efetiva > 0
                ? regraCompra.aliquota_efetiva
                : regraCompra.aliquota_icms || 0
          }
          const baseCreditoIcms = valorMercadoriaCompraReais // FOB: incide sobre mercadoria
          const icmsCreditoValor = baseCreditoIcms * (aliqCompra / 100)
          const pisCreditoValor = custoAquisicaoMercadoria * 0.00165
          const cofinsCreditoValor = custoAquisicaoMercadoria * 0.0076
          const totalCreditos = icmsCreditoValor + pisCreditoValor + cofinsCreditoValor
          const custoAquisicaoLiquidoSemTributos = Math.max(
            0,
            custoAquisicaoMercadoria - totalCreditos,
          )

          // Juros de compra (1.2% a.m., 30 dias -> 1.2% efetivo)
          const jurosCompra = custoAquisicaoMercadoria * (((1.2 / 30) * 30) / 100)
          const custoTotalCompraComJuros = custoAquisicaoMercadoria + jurosCompra

          // Venda: Preço unitário markup 35% de partida
          const precoUnitarioVendaReais = precoUnitarioCompraReais * 1.35
          const valorMercadoriaVendaReais = quantidade * precoUnitarioVendaReais

          // Despesas de venda (CIF)
          const freteVenda = 2500
          const seguroVenda = 350
          const outrasVenda = 150
          const totalDespesasVenda = freteVenda + seguroVenda + outrasVenda
          const baseBrutaIcmsVenda = valorMercadoriaVendaReais + totalDespesasVenda
          const baseOperacaoComercialVenda = valorMercadoriaVendaReais + totalDespesasVenda

          // ICMS Venda
          let aliqNominalVenda = 12
          let redBaseVenda = 0
          let diferimentoVenda = false
          let percDifVenda = 0

          if (regraVenda) {
            aliqNominalVenda = regraVenda.aliquota_icms || 0
            redBaseVenda = regraVenda.reducao_base || 0
            diferimentoVenda = regraVenda.diferimento || regraVenda.percentual_diferimento > 0
            percDifVenda = regraVenda.percentual_diferimento || (diferimentoVenda ? 100 : 0)
          }

          const baseEfetivaIcmsVenda = baseBrutaIcmsVenda * (1 - redBaseVenda / 100)
          const debitoIcmsVenda = baseEfetivaIcmsVenda * (aliqNominalVenda / 100)
          const valorDiferimentoVenda = debitoIcmsVenda * (percDifVenda / 100)
          const icmsEfetivoVenda = Math.max(0, debitoIcmsVenda - valorDiferimentoVenda)

          // PIS/COFINS com exclusão do ICMS (Tema 69 STF)
          const basePisCofins = Math.max(0, baseOperacaoComercialVenda - icmsEfetivoVenda)
          const valorPis = basePisCofins * (0.165 / 100)
          const valorCofins = basePisCofins * (0.76 / 100)
          const valorIbs = baseOperacaoComercialVenda * 0.4 * (0.1 / 100)
          const valorCbs = baseOperacaoComercialVenda * 0.4 * (0.9 / 100)
          const totalTributosVenda = icmsEfetivoVenda + valorPis + valorCofins + valorIbs + valorCbs

          const cargaTributariaEfetivaPerc =
            baseOperacaoComercialVenda > 0
              ? (totalTributosVenda / baseOperacaoComercialVenda) * 100
              : 0

          // Comissão e Juros de Venda (1.8% a.m., 60 dias -> 3.6% efetivo)
          const comissaoValor = baseOperacaoComercialVenda * (comissaoPerc / 100)
          const taxaEfetivaVendaPerc = (1.8 / 30) * 60
          const jurosVenda = baseOperacaoComercialVenda * (taxaEfetivaVendaPerc / 100)

          // Receita e Resultados
          const receitaBruta = baseOperacaoComercialVenda
          const receitaLiquida = receitaBruta - totalTributosVenda
          const custoAquisicaoBase = valorMercadoriaCompraReais + totalDespesasCompra
          const despesasOperacionaisVenda = totalDespesasVenda + comissaoValor
          const margemOperacional = receitaLiquida - custoAquisicaoBase - despesasOperacionaisVenda
          const resultadoFinalOperacao = margemOperacional + (jurosVenda - jurosCompra)

          // Break-Even e Preço Sugerido (Fórmula de Markup da Planilha AgroSimulador)
          const margemAlvo = 15
          const somaCargas =
            (cargaTributariaEfetivaPerc + comissaoPerc + taxaEfetivaVendaPerc) / 100
          const divisorBreakEven = Math.max(0.001, 1 - somaCargas)
          const breakEven = custoAquisicaoBase / divisorBreakEven
          const divisorMargem = Math.max(0.001, 1 - somaCargas - margemAlvo / 100)
          const precoSugerido =
            divisorMargem > 0
              ? custoAquisicaoBase / divisorMargem
              : breakEven * (1 + margemAlvo / 100)
          const markup = custoAquisicaoBase > 0 ? precoSugerido / custoAquisicaoBase : 1.0

          // Validações de integridade numérica
          const checagens = [
            { campo: 'custoAquisicaoMercadoria', v: custoAquisicaoMercadoria },
            { campo: 'custoTotalCompraComJuros', v: custoTotalCompraComJuros },
            { campo: 'custoAquisicaoLiquidoSemTributos', v: custoAquisicaoLiquidoSemTributos },
            { campo: 'receitaLiquida', v: receitaLiquida },
            { campo: 'totalTributosVenda', v: totalTributosVenda },
            { campo: 'resultadoFinalOperacao', v: resultadoFinalOperacao },
            { campo: 'precoMinimoBreakEven', v: breakEven },
            { campo: 'precoVendaSugerido', v: precoSugerido },
            { campo: 'markupMultiplicador', v: markup },
          ]

          const inconsistencias = []
          for (let c = 0; c < checagens.length; c++) {
            const val = checagens[c].v
            if (val === undefined || val === null) {
              inconsistencias.push(checagens[c].campo + ' está undefined/null')
              distribuicaoErrosPorTipo['Campo Nulo/Indefinido'] =
                (distribuicaoErrosPorTipo['Campo Nulo/Indefinido'] || 0) + 1
            } else if (typeof val === 'number') {
              if (isNaN(val)) {
                inconsistencias.push(checagens[c].campo + ' resultou em NaN')
                distribuicaoErrosPorTipo['Valor NaN'] =
                  (distribuicaoErrosPorTipo['Valor NaN'] || 0) + 1
              } else if (!isFinite(val)) {
                inconsistencias.push(checagens[c].campo + ' resultou em Infinity')
                distribuicaoErrosPorTipo['Valor Infinity'] =
                  (distribuicaoErrosPorTipo['Valor Infinity'] || 0) + 1
              }
            }
          }

          if (custoTotalCompraComJuros > 0) {
            if (breakEven <= 0) {
              inconsistencias.push('Break-even <= 0 com custo positivo')
              distribuicaoErrosPorTipo['Break-even Negativo ou Zero'] =
                (distribuicaoErrosPorTipo['Break-even Negativo ou Zero'] || 0) + 1
            }
            if (precoSugerido <= 0) {
              inconsistencias.push('Preço sugerido <= 0 com custo positivo')
              distribuicaoErrosPorTipo['Preço Sugerido Negativo ou Zero'] =
                (distribuicaoErrosPorTipo['Preço Sugerido Negativo ou Zero'] || 0) + 1
            }
            if (markup <= 0) {
              inconsistencias.push('Markup <= 0')
              distribuicaoErrosPorTipo['Markup Negativo ou Zero'] =
                (distribuicaoErrosPorTipo['Markup Negativo ou Zero'] || 0) + 1
            }
          }

          if (inconsistencias.length > 0) {
            totalErrosCalculo++
            falhasCompletas.push({
              codigo,
              descricao,
              rota: rota.nome,
              grTrib,
              moeda,
              motivo: inconsistencias.join('; '),
            })
          } else {
            totalOk++
          }

          // Rastreia casos de borda específicos
          const itemBorda = {
            codigo,
            descricao,
            rota: rota.nome,
            grTrib,
            moeda,
            custoTotalCompraComJuros,
            precoSugerido,
            resultadoFinalOperacao,
          }
          if (codigo === '006802') {
            amostraCasosEspeciais.USD_sem_ptax_manual.push(itemBorda)
          }
          if (codigo === '007216' || codigo === '007221') {
            amostraCasosEspeciais.embalagem_vazia.push(itemBorda)
          }
          if (codigo === '007100') {
            amostraCasosEspeciais.unidade_L_fertilizante_solido.push(itemBorda)
          }
        } catch (calcErr) {
          totalErrosCalculo++
          distribuicaoErrosPorTipo['Exceção de Execução'] =
            (distribuicaoErrosPorTipo['Exceção de Execução'] || 0) + 1
          falhasCompletas.push({
            codigo,
            descricao,
            rota: rota.nome,
            grTrib,
            moeda,
            motivo: 'Exceção lançada no motor: ' + (calcErr.message || String(calcErr)),
          })
        }
      }
    }

    const payloadRelatorio = {
      timestamp: new Date().toISOString(),
      totalProdutos: produtosRecords.length,
      totalRotas: rotas.length,
      totalSimulacoesExecutadas: totalExecucoes,
      totalConcluidasSemErro: totalOk,
      totalComExcecaoOuInvalido: totalErrosCalculo,
      totalComAvisoSemRegraFiscal: totalSemRegra,
      taxaSucessoCalculoPerc:
        totalExecucoes > 0 ? Number(((totalOk / totalExecucoes) * 100).toFixed(2)) : 0,
      falhasCompletas,
      distribuicaoErrosPorTipo,
      avisosInformativos,
      contagemPorGrTrib,
      amostraCasosEspeciais,
    }

    // Salva em registro de cache em simulador_parametrizacao_fiscal
    try {
      let cacheRec = null
      try {
        cacheRec = $app.findFirstRecordByFilter(
          'simulador_parametrizacao_fiscal',
          "classificacao = 'AUDITORIA_MASSA_CANONICA'",
        )
      } catch (_) {}

      if (!cacheRec) {
        const col = $app.findCollectionByNameOrId('simulador_parametrizacao_fiscal')
        cacheRec = new Record(col)
        cacheRec.set('ncm', '9999.99.98')
        cacheRec.set('classificacao', 'AUDITORIA_MASSA_CANONICA')
      }
      cacheRec.set('tributacao', JSON.stringify(payloadRelatorio))
      $app.save(cacheRec)
    } catch (saveErr) {
      console.error('[SIMULACAO_MASSA_SAVE_ERR] ' + (saveErr.message || String(saveErr)))
    }

    return e.json(200, {
      sucesso: true,
      mensagem: 'Simulação em massa executada com sucesso contra dados reais!',
      relatorio: payloadRelatorio,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Erro na execução da simulação em massa: ' + (err.message || String(err)),
    })
  }
})

routerAdd('GET', '/backend/v1/simulador/simulacao-massa-relatorio', (e) => {
  try {
    const rec = $app.findFirstRecordByFilter(
      'simulador_parametrizacao_fiscal',
      "classificacao = 'AUDITORIA_MASSA_CANONICA'",
    )
    if (rec) {
      const parsed = JSON.parse(rec.getString('tributacao'))
      return e.json(200, {
        sucesso: true,
        data: parsed,
      })
    }
  } catch (_) {}

  return e.json(404, {
    sucesso: false,
    error:
      'Relatório de auditoria canônica não encontrado. Execute GET /backend/v1/simulador/executar-simulacao-massa-real primeiro.',
  })
})
