/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Cópia integral de sim_produtos_base -> simulador_produtos
    try {
      const origProdCol = app.findCollectionByNameOrId('sim_produtos_base')
      const destProdCol = app.findCollectionByNameOrId('simulador_produtos')

      if (origProdCol && destProdCol) {
        let page = 0
        const batchSize = 100
        while (true) {
          const origRecords = app.findRecordsByFilter(
            origProdCol.id,
            '',
            'created',
            batchSize,
            page * batchSize,
          )
          if (!origRecords || origRecords.length === 0) break

          for (const orig of origRecords) {
            const codigo = orig.getString('codigo')
            const descricao = orig.getString('descricao')

            // Verificar idempotência: não duplicar se já existir
            let exists = false
            if (codigo) {
              const filter = "codigo = '" + codigo.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destProdCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            } else if (descricao) {
              const filter = "descricao = '" + descricao.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destProdCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            }

            if (!exists) {
              const dest = new Record(destProdCol)
              dest.set('codigo', orig.getString('codigo'))
              dest.set('descricao', orig.getString('descricao'))
              dest.set('ncm', orig.getString('ncm'))
              dest.set('unidade', orig.getString('unidade'))
              dest.set('tipo_produto', orig.getString('tipo_produto'))
              dest.set('origem', orig.getString('origem'))
              dest.set('embalagem', orig.getString('embalagem'))
              dest.set('principio_ativo', orig.getString('principio_ativo'))
              dest.set('fabricante', orig.getString('fabricante'))
              dest.set('moeda', orig.getString('moeda'))
              dest.set('preco_base_sugerido', orig.getFloat('preco_base_sugerido'))
              dest.set('gr_trib', orig.getString('gr_trib'))
              dest.set('grupo_codigo', orig.getString('grupo_codigo'))
              dest.set('grupo_descricao', orig.getString('grupo_descricao'))
              dest.set('descricao_grupo_tributario', orig.getString('descricao_grupo_tributario'))
              dest.set('segmento', orig.getString('segmento'))
              dest.set('comissao_padrao', orig.getFloat('comissao_padrao'))

              const dadosExtrasStr = orig.getString('dados_extras')
              if (dadosExtrasStr && dadosExtrasStr !== 'null') {
                try {
                  dest.set('dados_extras', JSON.parse(dadosExtrasStr))
                } catch (_) {}
              }

              app.save(dest)
            }
          }
          page++
        }
      }
    } catch (err) {
      console.log('Aviso ao copiar sim_produtos_base: ' + err)
    }

    // 2. Cópia integral de sim_regras_icms -> simulador_regras_icms
    try {
      const origIcmsCol = app.findCollectionByNameOrId('sim_regras_icms')
      const destIcmsCol = app.findCollectionByNameOrId('simulador_regras_icms')

      if (origIcmsCol && destIcmsCol) {
        let page = 0
        const batchSize = 100
        while (true) {
          const origRecords = app.findRecordsByFilter(
            origIcmsCol.id,
            '',
            'created',
            batchSize,
            page * batchSize,
          )
          if (!origRecords || origRecords.length === 0) break

          for (const orig of origRecords) {
            const chave = orig.getString('chave_origem_destino')
            const idRegra = orig.getString('id_regra')
            const ufOrig = orig.getString('uf_origem')
            const ufDest = orig.getString('uf_destino')

            let exists = false
            if (chave) {
              const filter = "chave_origem_destino = '" + chave.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destIcmsCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            } else if (idRegra) {
              const filter = "id_regra = '" + idRegra.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destIcmsCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            } else {
              const filter = "uf_origem = '" + ufOrig + "' && uf_destino = '" + ufDest + "'"
              const existing = app.findRecordsByFilter(destIcmsCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            }

            if (!exists) {
              const dest = new Record(destIcmsCol)
              dest.set('uf_origem', orig.getString('uf_origem'))
              dest.set('uf_destino', orig.getString('uf_destino'))
              dest.set('aliquota_icms', orig.getFloat('aliquota_icms'))
              dest.set('reducao_base', orig.getFloat('reducao_base'))
              dest.set('aliquota_efetiva', orig.getFloat('aliquota_efetiva'))
              dest.set('diferimento', orig.getBool('diferimento'))
              dest.set('percentual_diferimento', orig.getFloat('percentual_diferimento'))
              dest.set('fundamentacao_legal', orig.getString('fundamentacao_legal'))
              dest.set('tipo_operacao', orig.getString('tipo_operacao'))
              dest.set('chave_origem_destino', orig.getString('chave_origem_destino'))
              dest.set('id_regra', orig.getString('id_regra'))
              dest.set('tipo_uf_origem', orig.getString('tipo_uf_origem'))
              dest.set('tipo_uf_destino', orig.getString('tipo_uf_destino'))
              dest.set('grupo_tributario_codigo', orig.getString('grupo_tributario_codigo'))
              dest.set('grupo_tributario_descricao', orig.getString('grupo_tributario_descricao'))
              dest.set('prod_importado', orig.getString('prod_importado'))
              dest.set('tipo_desonerado', orig.getString('tipo_desonerado'))
              dest.set('icms_desonerado', orig.getFloat('icms_desonerado'))
              dest.set('regra_credito_entrada', orig.getString('regra_credito_entrada'))

              const dadosExtrasStr = orig.getString('dados_extras')
              if (dadosExtrasStr && dadosExtrasStr !== 'null') {
                try {
                  dest.set('dados_extras', JSON.parse(dadosExtrasStr))
                } catch (_) {}
              }

              app.save(dest)
            }
          }
          page++
        }
      }
    } catch (err) {
      console.log('Aviso ao copiar sim_regras_icms: ' + err)
    }

    // 3. Cópia integral de base_mestre -> simulador_base_mestre
    try {
      const origMestreCol = app.findCollectionByNameOrId('base_mestre')
      const destMestreCol = app.findCollectionByNameOrId('simulador_base_mestre')

      if (origMestreCol && destMestreCol) {
        let page = 0
        const batchSize = 100
        while (true) {
          const origRecords = app.findRecordsByFilter(
            origMestreCol.id,
            '',
            'created',
            batchSize,
            page * batchSize,
          )
          if (!origRecords || origRecords.length === 0) break

          for (const orig of origRecords) {
            const nomeProd = orig.getString('nome_produto')
            const regMapa = orig.getString('registro_mapa')

            let exists = false
            if (regMapa && regMapa.trim()) {
              const filter = "registro_mapa = '" + regMapa.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destMestreCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            } else if (nomeProd) {
              const filter = "nome_produto = '" + nomeProd.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destMestreCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            }

            if (!exists) {
              const dest = new Record(destMestreCol)
              dest.set('nome_produto', orig.getString('nome_produto'))
              dest.set('marca_padronizada', orig.getString('marca_padronizada'))
              dest.set('nome_completo', orig.getString('nome_completo'))
              dest.set('ncm', orig.getString('ncm'))
              dest.set('ncm_padrao', orig.getString('ncm_padrao'))
              dest.set('ncm_especifica', orig.getString('ncm_especifica'))
              dest.set('embalagem', orig.getString('embalagem'))
              dest.set('principio_ativo', orig.getString('principio_ativo'))
              dest.set('fabricante', orig.getString('fabricante'))
              dest.set('titular_fabricante', orig.getString('titular_fabricante'))
              dest.set('registro_mapa', orig.getString('registro_mapa'))
              dest.set('status_validacao', orig.getString('status_validacao'))
              dest.set('tipo_produto', orig.getString('tipo_produto'))
              dest.set('unidade', orig.getString('unidade'))
              dest.set('macro_grupo', orig.getString('macro_grupo'))
              dest.set('sub_grupo', orig.getString('sub_grupo'))
              dest.set('status_pis_cofins', orig.getString('status_pis_cofins'))
              dest.set('aliquota_ate_mar2026', orig.getString('aliquota_ate_mar2026'))
              dest.set('aliquota_pos_abr2026_real', orig.getString('aliquota_pos_abr2026_real'))
              dest.set(
                'aliquota_pos_abr2026_presumido',
                orig.getString('aliquota_pos_abr2026_presumido'),
              )
              dest.set('cst_saida', orig.getString('cst_saida'))
              dest.set('cst_entrada', orig.getString('cst_entrada'))
              dest.set('ibs_cbs_2027', orig.getString('ibs_cbs_2027'))
              dest.set('regra_tipi', orig.getString('regra_tipi'))

              const classifStr = orig.getString('dados_classificacao')
              if (classifStr && classifStr !== 'null') {
                try {
                  dest.set('dados_classificacao', JSON.parse(classifStr))
                } catch (_) {}
              }

              app.save(dest)
            }
          }
          page++
        }
      }
    } catch (err) {
      console.log('Aviso ao copiar base_mestre: ' + err)
    }

    // 4. Cópia integral de parametrizacao_fiscal -> simulador_parametrizacao_fiscal
    try {
      const origParamCol = app.findCollectionByNameOrId('parametrizacao_fiscal')
      const destParamCol = app.findCollectionByNameOrId('simulador_parametrizacao_fiscal')

      if (origParamCol && destParamCol) {
        const origRecords = app.findRecordsByFilter(origParamCol.id, '', 'created', 500, 0)
        for (const orig of origRecords) {
          const ncm = orig.getString('ncm')
          let exists = false
          if (ncm) {
            const filter = "ncm = '" + ncm.replace(/'/g, "\\'") + "'"
            const existing = app.findRecordsByFilter(destParamCol.id, filter, '', 1, 0)
            if (existing && existing.length > 0) exists = true
          }

          if (!exists) {
            const dest = new Record(destParamCol)
            dest.set('ncm', orig.getString('ncm'))
            dest.set('aliquota_pis', orig.getFloat('aliquota_pis'))
            dest.set('aliquota_cofins', orig.getFloat('aliquota_cofins'))
            dest.set('regime', orig.getString('regime'))
            dest.set('aliquota_ibs', orig.getFloat('aliquota_ibs'))
            dest.set('aliquota_cbs', orig.getFloat('aliquota_cbs'))
            dest.set('classificacao', orig.getString('classificacao'))
            dest.set('tributacao', orig.getString('tributacao'))
            app.save(dest)
          }
        }
      }
    } catch (err) {
      console.log('Aviso ao copiar parametrizacao_fiscal: ' + err)
    }

    // 5. Cópia integral de regras_ncm_embalagem -> simulador_regras_embalagem
    try {
      const origEmbCol = app.findCollectionByNameOrId('regras_ncm_embalagem')
      const destEmbCol = app.findCollectionByNameOrId('simulador_regras_embalagem')

      if (origEmbCol && destEmbCol) {
        const origRecords = app.findRecordsByFilter(origEmbCol.id, '', 'created', 500, 0)
        for (const orig of origRecords) {
          const ncm = orig.getString('ncm')
          let exists = false
          if (ncm) {
            const filter = "ncm = '" + ncm.replace(/'/g, "\\'") + "'"
            const existing = app.findRecordsByFilter(destEmbCol.id, filter, '', 1, 0)
            if (existing && existing.length > 0) exists = true
          }

          if (!exists) {
            const dest = new Record(destEmbCol)
            dest.set('ncm', orig.getString('ncm'))
            dest.set('descricao', orig.getString('descricao'))
            dest.set('regra_especial', orig.getString('regra_especial'))

            const embStr = orig.getString('embalagens_permitidas')
            if (embStr && embStr !== 'null') {
              try {
                dest.set('embalagens_permitidas', JSON.parse(embStr))
              } catch (_) {}
            }

            app.save(dest)
          }
        }
      }
    } catch (err) {
      console.log('Aviso ao copiar regras_ncm_embalagem: ' + err)
    }

    // 6. Cópia integral de dicionario_principios_ativos -> simulador_principios_ativos
    try {
      const origPaCol = app.findCollectionByNameOrId('dicionario_principios_ativos')
      const destPaCol = app.findCollectionByNameOrId('simulador_principios_ativos')

      if (origPaCol && destPaCol) {
        let page = 0
        const batchSize = 100
        while (true) {
          const origRecords = app.findRecordsByFilter(
            origPaCol.id,
            '',
            'created',
            batchSize,
            page * batchSize,
          )
          if (!origRecords || origRecords.length === 0) break

          for (const orig of origRecords) {
            const chave = orig.getString('principio_ativo_chave')
            const paNome = orig.getString('principio_ativo')

            let exists = false
            if (chave) {
              const filter = "principio_ativo_chave = '" + chave.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destPaCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            } else if (paNome) {
              const filter = "principio_ativo = '" + paNome.replace(/'/g, "\\'") + "'"
              const existing = app.findRecordsByFilter(destPaCol.id, filter, '', 1, 0)
              if (existing && existing.length > 0) exists = true
            }

            if (!exists) {
              const dest = new Record(destPaCol)
              dest.set('principio_ativo', orig.getString('principio_ativo'))
              dest.set('principio_ativo_chave', orig.getString('principio_ativo_chave'))
              dest.set('classe', orig.getString('classe'))
              dest.set('grupo_quimico', orig.getString('grupo_quimico'))
              dest.set('concentracao_min', orig.getFloat('concentracao_min'))
              dest.set('concentracao_max', orig.getFloat('concentracao_max'))
              dest.set('unidade', orig.getString('unidade'))
              dest.set('status', orig.getString('status'))
              dest.set('ncm_padrao_referencia', orig.getString('ncm_padrao_referencia'))
              dest.set('nota_subpos_2', orig.getString('nota_subpos_2'))
              dest.set('regra_tipi_embalagem', orig.getString('regra_tipi_embalagem'))
              dest.set('enquadramento_pis_cofins', orig.getString('enquadramento_pis_cofins'))
              dest.set('cst_recomendado', orig.getString('cst_recomendado'))
              app.save(dest)
            }
          }
          page++
        }
      }
    } catch (err) {
      console.log('Aviso ao copiar dicionario_principios_ativos: ' + err)
    }
  },
  (app) => {
    // Reversão segura: no-op para não perder dados inseridos
  },
)
