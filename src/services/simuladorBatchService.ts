import pb from '@/lib/pocketbase/client'

export interface ItemErroImportacao {
  linhaOriginal: number
  linhaLote: number
  motivo: string
  categoria: string
  campo?: string
  valor?: string
  dados: Record<string, unknown>
}

export interface ResultadoImportacaoLote {
  inseridos: number
  atualizados?: number
  ignorados: number
  espelhadosBaseMestre?: number
  duplicadasNoLote?: Record<string, number>
  erros: ItemErroImportacao[]
  resumoCategorias: Record<string, number>
}

/**
 * Executa uma operação com auto-retry e backoff exponencial em caso de erro transitório ou HTTP 429
 */
async function executarComRetry<T>(
  operacao: () => Promise<T>,
  maxTentativas = 4,
  baseDelayMs = 400,
): Promise<T> {
  let tentativa = 0
  while (tentativa < maxTentativas) {
    try {
      return await operacao()
    } catch (err: any) {
      tentativa++
      const status = err?.status || err?.statusCode || 0
      const isRateLimit = status === 429
      if (tentativa >= maxTentativas) {
        throw err
      }
      const delay = isRateLimit
        ? tentativa * 800 + Math.random() * 400
        : tentativa * baseDelayMs + Math.random() * 200
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Falha após múltiplas tentativas')
}

/**
 * Importação em lote resiliente para coleções próprias do simulador ('simulador_produtos' ou 'simulador_regras_icms')
 * com upsert idempotente:
 * - Produtos: busca por código + embalagem (ou código / descrição)
 * - ICMS: busca por chave_origem_destino (ou id_regra / par de UFs + grtrib)
 *
 * Suporta rate-limiting, retries com backoff exponencial e callback de progresso.
 */
export async function importarEmLoteSimulador<T extends Record<string, unknown>>(
  collectionName: 'simulador_produtos' | 'simulador_regras_icms',
  records: { data: T; originalLine?: number }[],
  onProgress?: (processados: number, total: number) => void,
): Promise<ResultadoImportacaoLote> {
  let inseridos = 0
  let atualizados = 0
  let ignorados = 0
  const duplicadasNoLote: Record<string, number> = {}
  const erros: ItemErroImportacao[] = []
  const resumoCategorias: Record<string, number> = {}
  const total = records.length

  if (total === 0) {
    return {
      inseridos: 0,
      atualizados: 0,
      ignorados: 0,
      erros: [],
      resumoCategorias: {},
    }
  }

  // Se o endpoint otimizado /backend/v1/importar-lote estiver disponível no backend
  // tentamos usá-lo; se falhar, usamos o upsert idempotente via SDK.
  const token = pb.authStore.token
  const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''
  const endpointUrl = `${baseUrl}/backend/v1/importar-lote`

  let usarEndpointBackend = true
  const CHUNK_SIZE_BACKEND = 200

  try {
    const testChunk = records.slice(0, Math.min(5, total))
    const testResp = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: token } : {}),
      },
      body: JSON.stringify({
        collection: collectionName,
        records: testChunk,
      }),
    })

    if (!testResp.ok) {
      usarEndpointBackend = false
    }
  } catch {
    usarEndpointBackend = false
  }

  if (usarEndpointBackend) {
    let processados = 0
    for (let offset = 0; offset < total; offset += CHUNK_SIZE_BACKEND) {
      const chunk = records.slice(offset, offset + CHUNK_SIZE_BACKEND)
      const payload = {
        collection: collectionName,
        records: chunk,
      }

      let respostaChunk: {
        sucesso: boolean
        inseridos: number
        atualizados: number
        ignorados: number
        duplicadasNoLote?: Record<string, number>
        erros: ItemErroImportacao[]
        resumoCategorias: Record<string, number>
      } | null = null

      try {
        respostaChunk = await executarComRetry(async () => {
          const resp = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: token } : {}),
            },
            body: JSON.stringify(payload),
          })
          if (!resp.ok) {
            const errJson = await resp.json().catch(() => ({}))
            const msg = errJson.error || errJson.message || `HTTP ${resp.status}`
            const error = new Error(msg) as any
            error.status = resp.status
            throw error
          }
          return await resp.json()
        })
      } catch (err: any) {
        chunk.forEach((item, idxInChunk) => {
          const rowNum = item.originalLine ?? offset + idxInChunk + 1
          const msg = err?.message || String(err)
          const cat = msg.includes('429') ? 'Limite de Requisições (429)' : 'Erro no Banco de Dados'
          erros.push({
            linhaOriginal: rowNum,
            linhaLote: offset + idxInChunk + 1,
            motivo: msg,
            categoria: cat,
            campo: 'Servidor',
            valor: 'Falha no endpoint em lote',
            dados: item.data,
          })
          resumoCategorias[cat] = (resumoCategorias[cat] || 0) + 1
        })
      }

      if (respostaChunk) {
        inseridos += respostaChunk.inseridos || 0
        atualizados += respostaChunk.atualizados || 0
        ignorados += respostaChunk.ignorados || 0
        if (respostaChunk.duplicadasNoLote) {
          for (const [k, v] of Object.entries(respostaChunk.duplicadasNoLote)) {
            duplicadasNoLote[k] = (duplicadasNoLote[k] || 0) + v
          }
        }
        if (Array.isArray(respostaChunk.erros)) {
          respostaChunk.erros.forEach((e) => {
            erros.push(e)
            const cat = e.categoria || 'Erro no Banco de Dados'
            resumoCategorias[cat] = (resumoCategorias[cat] || 0) + 1
          })
        }
      }

      processados += chunk.length
      if (onProgress) {
        onProgress(Math.min(processados, total), total)
      }
    }

    return {
      inseridos,
      atualizados,
      ignorados,
      duplicadasNoLote,
      erros,
      resumoCategorias,
    }
  }

  // Modo client-side resiliente com workers de concorrência controlada e upsert idempotente
  // Concorrência entre 3 e 5 requisições paralelas para alta velocidade sem estourar rate-limit
  const CONCORRENCIA = 4
  let processados = 0
  let indiceAtual = 0

  const worker = async () => {
    while (indiceAtual < records.length) {
      const idx = indiceAtual++
      const item = records[idx]
      const linhaOriginal = item.originalLine ?? idx + 1
      const dados = item.data as Record<string, any>

      try {
        if (collectionName === 'simulador_produtos') {
          const codigo = String(dados.codigo || '').trim()
          const embalagem = String(dados.embalagem || '').trim()
          const descricao = String(dados.descricao || '').trim()

          let existente: any = null

          // Busca idempotente: Código + Embalagem
          if (codigo && embalagem) {
            const escCod = codigo.replace(/'/g, "\\'")
            const escEmb = embalagem.replace(/'/g, "\\'")
            const busca = await executarComRetry(() =>
              pb.collection('simulador_produtos').getList(1, 1, {
                filter: `codigo = '${escCod}' && embalagem = '${escEmb}'`,
                fields: 'id,codigo,embalagem',
              }),
            )
            if (busca.items.length > 0) existente = busca.items[0]
          } else if (codigo) {
            const escCod = codigo.replace(/'/g, "\\'")
            const busca = await executarComRetry(() =>
              pb.collection('simulador_produtos').getList(1, 1, {
                filter: `codigo = '${escCod}'`,
                fields: 'id,codigo,embalagem',
              }),
            )
            if (busca.items.length > 0) existente = busca.items[0]
          } else if (descricao) {
            const escDesc = descricao.replace(/'/g, "\\'")
            const busca = await executarComRetry(() =>
              pb.collection('simulador_produtos').getList(1, 1, {
                filter: `descricao = '${escDesc}'`,
                fields: 'id,descricao',
              }),
            )
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (existente) {
            await executarComRetry(() =>
              pb.collection('simulador_produtos').update(existente.id, dados),
            )
            atualizados++
          } else {
            await executarComRetry(() => pb.collection('simulador_produtos').create(dados))
            inseridos++
          }
        } else if (collectionName === 'simulador_regras_icms') {
          const chave = String(dados.chave_origem_destino || '').trim()
          const idRegra = String(dados.id_regra || '').trim()
          const ufOrigem = String(dados.uf_origem || '').trim()
          const ufDestino = String(dados.uf_destino || '').trim()
          const grTrib = String(dados.grupo_tributario_codigo || '').trim()

          let existente: any = null

          if (chave) {
            const escChave = chave.replace(/'/g, "\\'")
            const busca = await executarComRetry(() =>
              pb.collection('simulador_regras_icms').getList(1, 1, {
                filter: `chave_origem_destino = '${escChave}'`,
                fields: 'id,chave_origem_destino',
              }),
            )
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (!existente && idRegra) {
            const escId = idRegra.replace(/'/g, "\\'")
            const busca = await executarComRetry(() =>
              pb.collection('simulador_regras_icms').getList(1, 1, {
                filter: `id_regra = '${escId}'`,
                fields: 'id,id_regra',
              }),
            )
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (!existente && ufOrigem && ufDestino) {
            const escOrig = ufOrigem.replace(/'/g, "\\'")
            const escDest = ufDestino.replace(/'/g, "\\'")
            const filterStr = grTrib
              ? `uf_origem = '${escOrig}' && uf_destino = '${escDest}' && grupo_tributario_codigo = '${grTrib.replace(/'/g, "\\'")}'`
              : `uf_origem = '${escOrig}' && uf_destino = '${escDest}'`
            const busca = await executarComRetry(() =>
              pb.collection('simulador_regras_icms').getList(1, 1, {
                filter: filterStr,
                fields: 'id,uf_origem,uf_destino',
              }),
            )
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (existente) {
            await executarComRetry(() =>
              pb.collection('simulador_regras_icms').update(existente.id, dados),
            )
            atualizados++
          } else {
            await executarComRetry(() => pb.collection('simulador_regras_icms').create(dados))
            inseridos++
          }
        }
      } catch (itemErr: any) {
        const msg = itemErr?.message || String(itemErr)
        const status = itemErr?.status || 0
        const cat = status === 429 ? 'Limite de Requisições (429)' : 'Erro no Banco de Dados'

        erros.push({
          linhaOriginal,
          linhaLote: idx + 1,
          motivo: msg,
          categoria: cat,
          campo: 'Banco',
          valor: String(dados.codigo || dados.chave_origem_destino || dados.descricao || ''),
          dados,
        })
        resumoCategorias[cat] = (resumoCategorias[cat] || 0) + 1
      }

      processados++
      if (onProgress && (processados % 15 === 0 || processados === total)) {
        onProgress(Math.min(processados, total), total)
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCORRENCIA, total) }, () => worker())
  await Promise.all(workers)

  return {
    inseridos,
    atualizados,
    ignorados,
    duplicadasNoLote,
    erros,
    resumoCategorias,
  }
}
