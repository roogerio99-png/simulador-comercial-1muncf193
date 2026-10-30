/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Servidor: Gravação em Lote Rápida do Simulador Comercial
 * Endpoint: POST /backend/v1/simulador/importar-lote
 *
 * REGRA DE SEGURANÇA ABSOLUTA:
 * - Apenas usuários autenticados da coleção 'simulador_comercial_users' com role = 'admin' podem executar.
 * - Nomes das coleções são EXCLUSIVAMENTE STRINGS LITERAIS FIXAS ('simulador_produtos' e 'simulador_regras_icms').
 * - NENHUM nome de coleção pode vir de variável externa, parâmetro arbitrário ou interpolação.
 * - NENHUMA coleção de outro app (como as do projeto 'Validação de Cadastro') pode ser lida nem escrita por este hook.
 * - Suporta transação por chunk, upsert idempotente direto no banco SQLite, reportando criados, atualizados, ignorados e erros item a item.
 */

routerAdd('POST', '/backend/v1/simulador/inspecionar-referencia', (e) => {
  try {
    const files = e.findUploadedFiles('arquivo')
    if (!files || files.length === 0) {
      return e.json(400, { error: 'Nenhum arquivo enviado' })
    }
    const { markdown, truncated } = $documents.toMarkdown({ file: files[0] })
    return e.json(200, { markdown, truncated })
  } catch (err) {
    console.error('ERROR_MARKDOWN:', err)
    return e.json(500, { error: String(err) })
  }
})

routerAdd('POST', '/backend/v1/simulador/importar-lote', (e) => {
  // 1. Validação de autenticação
  let authRecord = e.auth
  if (!authRecord) {
    try {
      const authHeader =
        (e.request && e.request.header && e.request.header.get('Authorization')) || ''
      const token = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (token) {
        authRecord = $app.findAuthRecordByToken(token, 'simulador_comercial_users')
      }
    } catch (_) {}
  }

  const colName =
    authRecord && authRecord.collection
      ? typeof authRecord.collection === 'function'
        ? authRecord.collection().name
        : authRecord.collection.name
      : ''

  if (!authRecord || colName !== 'simulador_comercial_users') {
    return e.json(401, {
      sucesso: false,
      error: 'Autenticação requerida na plataforma do Simulador Comercial.',
    })
  }

  // 2. Validação de autorização (apenas Admin)
  const role =
    authRecord && typeof authRecord.getString === 'function'
      ? authRecord.getString('role')
      : authRecord.role
  if (role !== 'admin') {
    return e.json(403, {
      sucesso: false,
      error: 'Apenas usuários com perfil Administrador podem executar importação em lote.',
    })
  }

  // 3. Leitura e validação dos dados da requisição
  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const collectionTarget = typeof data.collection === 'string' ? data.collection.trim() : ''
  const records = Array.isArray(data.records) ? data.records : []

  if (records.length === 0) {
    return e.json(200, {
      sucesso: true,
      inseridos: 0,
      atualizados: 0,
      atualizadosIntraLote: 0,
      atualizadosPreExistentes: 0,
      ignorados: 0,
      duplicadasNoLote: {},
      erros: [],
      resumoCategorias: {},
    })
  }

  let inseridos = 0
  let atualizados = 0
  let atualizadosIntraLote = 0
  let atualizadosPreExistentes = 0
  let ignorados = 0
  const erros = []
  const duplicadasNoLote = {}
  const resumoCategorias = {}

  // Registro de IDs criados durante esta execução (para distinguir duplicada intra-lote de pré-existente)
  const idsCriadosNestaExecucao = {}

  // 4. Execução protegida por coleção alvo (apenas literais fixos)
  if (collectionTarget === 'simulador_produtos') {
    const colModel = $app.findCollectionByNameOrId('simulador_produtos')

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < records.length; i++) {
        const item = records[i]
        const rowData = (item && item.data) || {}
        const originalLine = (item && item.originalLine) || i + 1

        const codigo = typeof rowData.codigo === 'string' ? rowData.codigo.trim() : ''
        const desc = typeof rowData.descricao === 'string' ? rowData.descricao.trim() : ''
        const emb = typeof rowData.embalagem === 'string' ? rowData.embalagem.trim() : ''

        if (!desc && !codigo) {
          ignorados++
          continue
        }

        // Chave de identificação composta: Código + Embalagem (ou Descrição + Embalagem se não houver código)
        const chaveDeduplicacao = codigo
          ? emb
            ? codigo.toUpperCase() + ' | ' + emb.toUpperCase()
            : codigo.toUpperCase()
          : emb
            ? desc.toUpperCase() + ' | ' + emb.toUpperCase()
            : desc.toUpperCase()

        if (chaveDeduplicacao) {
          duplicadasNoLote[chaveDeduplicacao] = (duplicadasNoLote[chaveDeduplicacao] || 0) + 1
        }

        try {
          // Idempotência estrita: busca se o registro já existe no banco.
          // REGRA DE SEGURANÇA CONTRA PERDA DE DADOS:
          // Se a linha possui `codigo`, busca EXCLUSIVAMENTE por código (+embalagem se houver).
          // NUNCA fazer fallback por descrição quando a linha tem código: se o código for novo,
          // o registro DEVE ser inserido, mesmo que haja outro produto com descrição similar/idêntica.
          let existente = null

          if (codigo) {
            const cleanCod = codigo.replace(/'/g, "''")
            let filter = "codigo = '" + cleanCod + "'"
            if (emb) {
              filter += " && embalagem = '" + emb.replace(/'/g, "''") + "'"
            }
            try {
              existente = txApp.findFirstRecordByFilter('simulador_produtos', filter)
            } catch (_) {
              existente = null
            }
          } else if (desc) {
            // O fallback por descrição SÓ é permitido quando a linha da planilha NÃO tem código
            const cleanDesc = desc.replace(/'/g, "''")
            let filter = "descricao = '" + cleanDesc + "'"
            if (emb) {
              filter += " && embalagem = '" + emb.replace(/'/g, "''") + "'"
            }
            try {
              existente = txApp.findFirstRecordByFilter('simulador_produtos', filter)
            } catch (_) {
              existente = null
            }
          }

          const rec = existente || new Record(colModel)

          // Preenchimento de campos canônicos
          if (codigo) rec.set('codigo', codigo)
          if (desc) rec.set('descricao', desc)
          if (rowData.ncm !== undefined && rowData.ncm !== null) {
            rec.set('ncm', String(rowData.ncm).trim())
          }
          if (rowData.unidade !== undefined && rowData.unidade !== null) {
            rec.set('unidade', String(rowData.unidade).trim() || 'UN')
          }
          if (rowData.origem !== undefined && rowData.origem !== null) {
            rec.set('origem', String(rowData.origem).trim() || 'Nacional')
          }
          if (rowData.tipo_produto !== undefined && rowData.tipo_produto !== null) {
            rec.set('tipo_produto', String(rowData.tipo_produto).trim())
          }
          if (emb) rec.set('embalagem', emb)
          if (rowData.principio_ativo !== undefined && rowData.principio_ativo !== null) {
            rec.set('principio_ativo', String(rowData.principio_ativo).trim())
          }
          if (rowData.fabricante !== undefined && rowData.fabricante !== null) {
            rec.set('fabricante', String(rowData.fabricante).trim())
          }
          if (rowData.moeda !== undefined && rowData.moeda !== null) {
            rec.set('moeda', String(rowData.moeda).trim().toUpperCase() || 'BRL')
          }
          if (rowData.preco_base_sugerido !== undefined && rowData.preco_base_sugerido !== null) {
            const p = Number(rowData.preco_base_sugerido)
            rec.set('preco_base_sugerido', isNaN(p) ? 0 : p)
          }
          if (rowData.gr_trib !== undefined && rowData.gr_trib !== null) {
            rec.set('gr_trib', String(rowData.gr_trib).trim())
          }
          if (rowData.grupo_codigo !== undefined && rowData.grupo_codigo !== null) {
            rec.set('grupo_codigo', String(rowData.grupo_codigo).trim())
          }
          if (rowData.grupo_descricao !== undefined && rowData.grupo_descricao !== null) {
            rec.set('grupo_descricao', String(rowData.grupo_descricao).trim())
          }
          if (
            rowData.descricao_grupo_tributario !== undefined &&
            rowData.descricao_grupo_tributario !== null
          ) {
            rec.set('descricao_grupo_tributario', String(rowData.descricao_grupo_tributario).trim())
          }
          if (rowData.segmento !== undefined && rowData.segmento !== null) {
            rec.set('segmento', String(rowData.segmento).trim())
          }
          if (rowData.comissao_padrao !== undefined && rowData.comissao_padrao !== null) {
            const c = Number(rowData.comissao_padrao)
            rec.set('comissao_padrao', isNaN(c) ? 0 : c)
          }
          if (rowData.dados_extras !== undefined && rowData.dados_extras !== null) {
            rec.set('dados_extras', rowData.dados_extras)
          }

          txApp.save(rec)

          if (existente) {
            atualizados++
            const recId = existente.id
            if (recId && idsCriadosNestaExecucao[recId]) {
              atualizadosIntraLote++
            } else {
              atualizadosPreExistentes++
            }
          } else {
            inseridos++
            if (rec.id) {
              idsCriadosNestaExecucao[rec.id] = true
            }
          }
        } catch (itemErr) {
          const errMsg = (itemErr && itemErr.message) || String(itemErr)
          erros.push({
            linhaOriginal: originalLine,
            linhaLote: i + 1,
            motivo: errMsg,
            categoria: 'Erro no Banco de Dados',
            campo: 'simulador_produtos',
            valor: codigo || desc || 'registro',
            dados: rowData,
          })
          resumoCategorias['Erro no Banco de Dados'] =
            (resumoCategorias['Erro no Banco de Dados'] || 0) + 1
        }
      }
    })

    return e.json(200, {
      sucesso: true,
      alvo: 'simulador_produtos',
      inseridos: inseridos,
      atualizados: atualizados,
      atualizadosIntraLote: atualizadosIntraLote,
      atualizadosPreExistentes: atualizadosPreExistentes,
      ignorados: ignorados,
      duplicadasNoLote: duplicadasNoLote,
      erros: erros,
      resumoCategorias: resumoCategorias,
    })
  } else if (collectionTarget === 'simulador_regras_icms') {
    const colModel = $app.findCollectionByNameOrId('simulador_regras_icms')

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < records.length; i++) {
        const item = records[i]
        const rowData = (item && item.data) || {}
        const originalLine = (item && item.originalLine) || i + 1

        const ufOrigem = (
          typeof rowData.uf_origem === 'string' ? rowData.uf_origem.trim().toUpperCase() : ''
        ).slice(0, 2)
        const ufDestino = (
          typeof rowData.uf_destino === 'string' ? rowData.uf_destino.trim().toUpperCase() : ''
        ).slice(0, 2)

        if (!ufOrigem || !ufDestino) {
          ignorados++
          continue
        }

        const idRegra =
          typeof rowData.id_regra === 'string'
            ? rowData.id_regra.trim()
            : rowData.id_regra !== undefined && rowData.id_regra !== null
              ? String(rowData.id_regra).trim()
              : ''
        const grTrib =
          typeof rowData.grupo_tributario_codigo === 'string'
            ? rowData.grupo_tributario_codigo.trim()
            : rowData.grupo_tributario_codigo !== undefined &&
                rowData.grupo_tributario_codigo !== null
              ? String(rowData.grupo_tributario_codigo).trim()
              : ''

        let chaveOrigemDestino =
          typeof rowData.chave_origem_destino === 'string' && rowData.chave_origem_destino.trim()
            ? rowData.chave_origem_destino.trim()
            : ufOrigem +
              '_' +
              ufDestino +
              (grTrib ? '_' + grTrib : '') +
              (idRegra ? '_' + idRegra : '')

        duplicadasNoLote[chaveOrigemDestino] = (duplicadasNoLote[chaveOrigemDestino] || 0) + 1

        try {
          // Idempotência estrita: busca existente.
          // Se a linha tem id_regra, busca prioritariamente por id_regra.
          // Se não encontrou por id_regra e tem chave_origem_destino, busca por chave_origem_destino.
          // O fallback por uf_origem + uf_destino + grTrib SÓ PODE ser acionado se NÃO houver id_regra
          // na linha, para evitar mesclar regras distintas que possuem id_regra próprio.
          let existente = null

          if (idRegra) {
            const cleanId = idRegra.replace(/'/g, "''")
            try {
              existente = txApp.findFirstRecordByFilter(
                'simulador_regras_icms',
                "id_regra = '" + cleanId + "'",
              )
            } catch (_) {
              existente = null
            }
          }

          if (!existente && chaveOrigemDestino) {
            const cleanChave = chaveOrigemDestino.replace(/'/g, "''")
            try {
              existente = txApp.findFirstRecordByFilter(
                'simulador_regras_icms',
                "chave_origem_destino = '" + cleanChave + "'",
              )
            } catch (_) {
              existente = null
            }
          }

          // Fallback por UF+GrTrib só é acionado se a linha NÃO tiver id_regra
          if (!existente && !idRegra) {
            let filter = "uf_origem = '" + ufOrigem + "' && uf_destino = '" + ufDestino + "'"
            if (grTrib) {
              filter += " && grupo_tributario_codigo = '" + grTrib.replace(/'/g, "''") + "'"
            }
            try {
              existente = txApp.findFirstRecordByFilter('simulador_regras_icms', filter)
            } catch (_) {
              existente = null
            }
          }

          const rec = existente || new Record(colModel)
          rec.set('uf_origem', ufOrigem)
          rec.set('uf_destino', ufDestino)
          rec.set('chave_origem_destino', chaveOrigemDestino)

          if (rowData.aliquota_icms !== undefined && rowData.aliquota_icms !== null) {
            const aliq = Number(rowData.aliquota_icms)
            rec.set('aliquota_icms', isNaN(aliq) ? 0 : aliq)
          }
          if (rowData.reducao_base !== undefined && rowData.reducao_base !== null) {
            const red = Number(rowData.reducao_base)
            rec.set('reducao_base', isNaN(red) ? 0 : red)
          }
          if (rowData.aliquota_efetiva !== undefined && rowData.aliquota_efetiva !== null) {
            const ef = Number(rowData.aliquota_efetiva)
            rec.set('aliquota_efetiva', isNaN(ef) ? 0 : ef)
          }
          if (rowData.diferimento !== undefined && rowData.diferimento !== null) {
            const d = rowData.diferimento
            const boolVal =
              typeof d === 'boolean'
                ? d
                : String(d).trim().toLowerCase() === 'true' ||
                  String(d).trim().toLowerCase() === 'sim' ||
                  String(d).trim() === '1' ||
                  String(d).trim().toLowerCase() === 's'
            rec.set('diferimento', boolVal)
          }
          if (
            rowData.percentual_diferimento !== undefined &&
            rowData.percentual_diferimento !== null
          ) {
            const pd = Number(rowData.percentual_diferimento)
            rec.set('percentual_diferimento', isNaN(pd) ? 0 : pd)
          }
          if (rowData.fundamentacao_legal !== undefined && rowData.fundamentacao_legal !== null) {
            rec.set('fundamentacao_legal', String(rowData.fundamentacao_legal).trim())
          }
          if (rowData.tipo_operacao !== undefined && rowData.tipo_operacao !== null) {
            rec.set('tipo_operacao', String(rowData.tipo_operacao).trim() || 'Interestadual')
          }
          if (idRegra) {
            rec.set('id_regra', idRegra)
          }
          if (rowData.tipo_uf_origem !== undefined && rowData.tipo_uf_origem !== null) {
            rec.set('tipo_uf_origem', String(rowData.tipo_uf_origem).trim())
          }
          if (rowData.tipo_uf_destino !== undefined && rowData.tipo_uf_destino !== null) {
            rec.set('tipo_uf_destino', String(rowData.tipo_uf_destino).trim())
          }
          if (grTrib) {
            rec.set('grupo_tributario_codigo', grTrib)
          }
          if (
            rowData.grupo_tributario_descricao !== undefined &&
            rowData.grupo_tributario_descricao !== null
          ) {
            rec.set('grupo_tributario_descricao', String(rowData.grupo_tributario_descricao).trim())
          }
          if (rowData.prod_importado !== undefined && rowData.prod_importado !== null) {
            rec.set('prod_importado', String(rowData.prod_importado).trim())
          }
          if (rowData.tipo_desonerado !== undefined && rowData.tipo_desonerado !== null) {
            rec.set('tipo_desonerado', String(rowData.tipo_desonerado).trim())
          }
          if (rowData.icms_desonerado !== undefined && rowData.icms_desonerado !== null) {
            const ides = Number(rowData.icms_desonerado)
            rec.set('icms_desonerado', isNaN(ides) ? 0 : ides)
          }
          if (
            rowData.regra_credito_entrada !== undefined &&
            rowData.regra_credito_entrada !== null
          ) {
            rec.set('regra_credito_entrada', String(rowData.regra_credito_entrada).trim())
          }
          if (rowData.dados_extras !== undefined && rowData.dados_extras !== null) {
            rec.set('dados_extras', rowData.dados_extras)
          }

          txApp.save(rec)

          if (existente) {
            atualizados++
            const recId = existente.id
            if (recId && idsCriadosNestaExecucao[recId]) {
              atualizadosIntraLote++
            } else {
              atualizadosPreExistentes++
            }
          } else {
            inseridos++
            if (rec.id) {
              idsCriadosNestaExecucao[rec.id] = true
            }
          }
        } catch (itemErr) {
          const errMsg = (itemErr && itemErr.message) || String(itemErr)
          erros.push({
            linhaOriginal: originalLine,
            linhaLote: i + 1,
            motivo: errMsg,
            categoria: 'Erro no Banco de Dados',
            campo: 'simulador_regras_icms',
            valor: chaveOrigemDestino || ufOrigem + '->' + ufDestino,
            dados: rowData,
          })
          resumoCategorias['Erro no Banco de Dados'] =
            (resumoCategorias['Erro no Banco de Dados'] || 0) + 1
        }
      }
    })

    return e.json(200, {
      sucesso: true,
      alvo: 'simulador_regras_icms',
      inseridos: inseridos,
      atualizados: atualizados,
      atualizadosIntraLote: atualizadosIntraLote,
      atualizadosPreExistentes: atualizadosPreExistentes,
      ignorados: ignorados,
      duplicadasNoLote: duplicadasNoLote,
      erros: erros,
      resumoCategorias: resumoCategorias,
    })
  } else {
    return e.json(400, {
      sucesso: false,
      error:
        "Coleção inválida. Apenas as coleções 'simulador_produtos' e 'simulador_regras_icms' são permitidas.",
    })
  }
})
