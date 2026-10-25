import pb from '@/lib/pocketbase/client'
import type { SimProdutoBase, SimRegraIcms } from '@/types/simulador'

export interface ProgressoLote {
  processados: number
  total: number
  criados: number
  atualizados: number
  falhas: number
  mensagem?: string
}

export interface ResultadoImportacao {
  total: number
  criados: number
  atualizados: number
  falhas: number
  erros: string[]
}

/**
 * Normaliza uma string de texto removendo acentos, pontuações e caixa
 */
export function normalizarNome(texto: string): string {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Converte valor textual/numérico em number seguro
 */
export function parseNumeroSeguro(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const str = String(val).trim().replace(/\s+/g, '')
  // Trata formato brasileiro (1.234,56 ou 4,8%)
  const limpo = str.replace(/%/g, '')
  if (limpo.includes(',') && !limpo.includes('.')) {
    const parsed = parseFloat(limpo.replace(',', '.'))
    return isNaN(parsed) ? 0 : parsed
  }
  if (limpo.includes('.') && limpo.includes(',')) {
    // 1.234,56
    const parsed = parseFloat(limpo.replace(/\./g, '').replace(',', '.'))
    return isNaN(parsed) ? 0 : parsed
  }
  const parsed = parseFloat(limpo)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Converte valor em booleano
 */
export function parseBoolSeguro(val: unknown): boolean {
  if (typeof val === 'boolean') return val
  if (!val) return false
  const s = String(val).trim().toLowerCase()
  return s === 'sim' || s === 'true' || s === '1' || s === 's' || s === 'yes'
}

/**
 * Definição dos campos para Mapeamento de Produtos
 */
export const CAMPOS_PRODUTO_MAP = [
  {
    key: 'codigo',
    label: 'Código do Produto (B1_COD / Código)',
    aliases: ['codigo', 'b1cod', 'cod', 'sku', 'codigoproduto'],
    required: false,
  },
  {
    key: 'descricao',
    label: 'Descrição Comercial (B1_DESC / Descrição)',
    aliases: ['descricao', 'b1desc', 'desc', 'nome', 'nomeproduto', 'produto'],
    required: true,
  },
  {
    key: 'ncm',
    label: 'NCM (B1_POSIPI / NCM)',
    aliases: ['ncm', 'b1posipi', 'classificacaofiscal', 'posipi'],
    required: false,
  },
  {
    key: 'unidade',
    label: 'Unidade (B1_UM / Unidade)',
    aliases: ['unidade', 'b1um', 'um', 'un'],
    required: false,
  },
  {
    key: 'origem',
    label: 'Origem (Nacional / Importado)',
    aliases: ['origem', 'b1origem', 'tipoorigem'],
    required: false,
  },
  {
    key: 'tipo_produto',
    label: 'Tipo de Produto',
    aliases: ['tipoproduto', 'tipo', 'categoriaproduto'],
    required: false,
  },
  {
    key: 'embalagem',
    label: 'Embalagem (4X5L, 20L, etc)',
    aliases: ['embalagem', 'emb', 'apresentacao'],
    required: false,
  },
  {
    key: 'principio_ativo',
    label: 'Princípio Ativo',
    aliases: ['principioativo', 'pa', 'ingredienteativo'],
    required: false,
  },
  {
    key: 'fabricante',
    label: 'Fabricante',
    aliases: ['fabricante', 'titular', 'marca'],
    required: false,
  },
  { key: 'moeda', label: 'Moeda (BRL / USD)', aliases: ['moeda', 'currency'], required: false },
  {
    key: 'preco_base_sugerido',
    label: 'Preço Base Sugerido',
    aliases: ['precobase', 'precobasesugerido', 'preco', 'valorsugerido', 'precovenda'],
    required: false,
  },
  {
    key: 'gr_trib',
    label: 'Grupo Tributário (GrTrib / B1_GRTRIB2)',
    aliases: ['grtrib', 'b1grtrib2', 'grtrib2', 'grupotributario'],
    required: false,
  },
  {
    key: 'grupo_codigo',
    label: 'Código do Grupo (B1_GRUPO)',
    aliases: ['grupocodigo', 'b1grupo', 'codigogrupo'],
    required: false,
  },
  {
    key: 'grupo_descricao',
    label: 'Descrição do Grupo (BM_DESC)',
    aliases: ['grupodescricao', 'bmdesc', 'descricaogrupo'],
    required: false,
  },
  {
    key: 'descricao_grupo_tributario',
    label: 'Desc. Grupo Tributário',
    aliases: ['descricaogrupotributario', 'x5descri', 'grupotributariodescricao'],
    required: false,
  },
  {
    key: 'segmento',
    label: 'Segmento (CROP, ESSENTIALS, etc)',
    aliases: ['segmento', 'linhaproduto'],
    required: false,
  },
  {
    key: 'comissao_padrao',
    label: 'Comissão Padrão (0.015 = 1,5%)',
    aliases: ['comissaopadrao', 'comissao', 'perc_comissao'],
    required: false,
  },
]

/**
 * Definição dos campos para Mapeamento de Regras Fiscais (ICMS)
 */
export const CAMPOS_REGRA_ICMS_MAP = [
  {
    key: 'uf_origem',
    label: 'UF Origem (ex: SP, PR, BA)',
    aliases: ['uforigem', 'origem', 'uforig', 'estadoorigem'],
    required: true,
  },
  {
    key: 'uf_destino',
    label: 'UF Destino (ex: MT, GO, RS)',
    aliases: ['ufdestino', 'destino', 'ufdest', 'ufcontrapartida', 'estadodestino'],
    required: true,
  },
  {
    key: 'aliquota_icms',
    label: 'Alíquota ICMS (ex: 4, 7, 12, 18)',
    aliases: ['aliquotaicms', 'cargatribicms', 'aliquota', 'icms', 'aliqicms'],
    required: false,
  },
  {
    key: 'reducao_base',
    label: 'Redução de Base (%)',
    aliases: ['reducaobase', 'reducao', 'percreducao', 'reducaodebase'],
    required: false,
  },
  {
    key: 'aliquota_efetiva',
    label: 'Alíquota Efetiva / Carga Final',
    aliases: ['aliquotaefetiva', 'cargaimcsfinal', 'cargafinal', 'aliquotafinal'],
    required: false,
  },
  {
    key: 'diferimento',
    label: 'Diferimento (Sim/Não)',
    aliases: ['diferimento', 'diferido', 'temdiferimento'],
    required: false,
  },
  {
    key: 'percentual_diferimento',
    label: '% Diferimento',
    aliases: ['percentualdiferimento', 'percdiferimento', 'diferimentoperc'],
    required: false,
  },
  {
    key: 'tipo_operacao',
    label: 'Tipo de Operação (Interestadual / Interna)',
    aliases: ['tipooperacao', 'operacao'],
    required: false,
  },
  {
    key: 'grupo_tributario_codigo',
    label: 'Código GrTrib (ex: 001, 002, 050)',
    aliases: ['grupotributariocodigo', 'grtrib', 'codigogrupotributario'],
    required: false,
  },
  {
    key: 'grupo_tributario_descricao',
    label: 'Descrição GrTrib',
    aliases: ['grupotributariodescricao', 'descricaogrupotributario', 'x5descri'],
    required: false,
  },
  {
    key: 'id_regra',
    label: 'ID da Regra na Matriz',
    aliases: ['idregra', 'id', 'regraicmsid', 'chave'],
    required: false,
  },
  {
    key: 'tipo_uf_origem',
    label: 'Tipo UF Origem (ex: ESTADO POBRE)',
    aliases: ['tipouforigem', 'classificacaouforigem'],
    required: false,
  },
  {
    key: 'tipo_uf_destino',
    label: 'Tipo UF Destino',
    aliases: ['tipoufdestino', 'classificacaoufdestino'],
    required: false,
  },
  {
    key: 'prod_importado',
    label: 'Produto Importado (Sim/Não)',
    aliases: ['prodimportado', 'importado', 'produtoimportado'],
    required: false,
  },
  {
    key: 'tipo_desonerado',
    label: 'Tipo Desonerado',
    aliases: ['tipodesonerado', 'desonerado'],
    required: false,
  },
  {
    key: 'icms_desonerado',
    label: 'Valor/Alíquota ICMS Desonerado',
    aliases: ['icmsdesonerado', 'valordesonerado'],
    required: false,
  },
  {
    key: 'regra_credito_entrada',
    label: 'Regra Crédito Entrada',
    aliases: ['regracreditoentrada', 'creditoentrada', 'regra_credito'],
    required: false,
  },
  {
    key: 'fundamentacao_legal',
    label: 'Fundamentação Legal',
    aliases: ['fundamentacaolegal', 'baselegal', 'convenio', 'fundamentacao'],
    required: false,
  },
]

/**
 * Executa deleção de um único registro de forma segura, com suporte a retentativas
 * exponenciais em caso de erro transitório ou HTTP 429 (Rate Limit).
 */
async function deletarRegistroComRetry(
  colecao: 'simulador_produtos' | 'simulador_regras_icms',
  id: string,
  maxTentativas = 4,
): Promise<boolean> {
  let esperaMs = 300

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      if (colecao === 'simulador_produtos') {
        await pb.collection('simulador_produtos').delete(id)
      } else {
        await pb.collection('simulador_regras_icms').delete(id)
      }
      return true
    } catch (err: any) {
      const status = err?.status || err?.statusCode || 0
      const isRateLimit = status === 429
      const isNotFound = status === 404

      // Se o registro já não existe, considera excluído com sucesso
      if (isNotFound) {
        return true
      }

      if (tentativa === maxTentativas) {
        console.error(`Falha definitiva ao excluir ${colecao} (id: ${id}):`, err)
        return false
      }

      // Backoff aumentado se 429
      const atraso = isRateLimit
        ? esperaMs * 2 + Math.random() * 300
        : esperaMs + Math.random() * 100
      await new Promise((resolve) => setTimeout(resolve, atraso))
      esperaMs *= 2
    }
  }

  return false
}

/**
 * Função auxiliar: exclusão em lote por IDs com concorrência controlada (4 a 6 workers),
 * retry + backoff em falhas (incluindo 429), tolerância a falhas por item sem abortar o todo,
 * e callback opcional de progresso para atualização em tempo real.
 */
async function executarExclusaoParalelaPorIds(
  colecao: 'simulador_produtos' | 'simulador_regras_icms',
  ids: string[],
  onProgresso?: (progresso: {
    apagados: number
    totalInicial: number
    emExecucao: boolean
  }) => void,
  totalInicialInformado?: number,
): Promise<{ sucesso: number; falhas: number }> {
  const total = ids.length
  if (total === 0) {
    return { sucesso: 0, falhas: 0 }
  }

  const totalParaContador = totalInicialInformado ?? total
  let sucesso = 0
  let falhas = 0
  let indiceAtual = 0
  let taxa429 = 0

  // Concorrência inicial adaptativa (inicia com 5 workers, ajustável entre 2 e 6)
  let concorrencia = 5

  const proximoTrabalho = async (): Promise<void> => {
    while (indiceAtual < ids.length) {
      const idx = indiceAtual++
      const id = ids[idx]
      if (!id) continue

      try {
        const ok = await deletarRegistroComRetry(colecao, id)
        if (ok) {
          sucesso++
        } else {
          falhas++
        }
      } catch (err: any) {
        falhas++
        if (err?.status === 429) {
          taxa429++
          // Reduz concorrência adaptativamente se encontrar rate limits
          if (taxa429 > 3 && concorrencia > 2) {
            concorrencia = Math.max(2, concorrencia - 1)
          }
        }
      }

      // Notifica progresso a cada lote pequeno ou no final
      const processados = sucesso + falhas
      if (onProgresso && (processados % 10 === 0 || processados === total)) {
        onProgresso({
          apagados: sucesso,
          totalInicial: totalParaContador,
          emExecucao: true,
        })
      }
    }
  }

  const workers = Array.from({ length: Math.min(concorrencia, ids.length) }, () =>
    proximoTrabalho(),
  )
  await Promise.all(workers)

  return { sucesso, falhas }
}

/**
 * Resposta da rota de limpeza rápida do servidor (/backend/v1/simulador/limpar-base)
 */
export interface RespostaLimparBaseServidor {
  sucesso: boolean
  alvo: 'simulador_produtos' | 'simulador_regras_icms'
  apagados: number
  mensagem: string
  error?: string
}

/**
 * Função auxiliar: limpeza de base via servidor (POST /backend/v1/simulador/limpar-base).
 * - Executa exclusão direta no banco pelo backend em segundos, sem tráfego registro a registro.
 * - Segurança absoluta: coleções como literais fixos ('simulador_produtos' ou 'simulador_regras_icms').
 * - Fallback automático para exclusão paralela cliente se a rota não estiver acessível.
 */
async function executarLimpezaBaseServidor(
  colecao: 'simulador_produtos' | 'simulador_regras_icms',
  onProgresso?: (progresso: {
    apagados: number
    totalInicial: number
    emExecucao: boolean
  }) => void,
): Promise<{ apagados: number; falhas: number }> {
  // 1. Obter contagem total inicial para informar progresso e resumo
  let totalInicial = 0
  try {
    if (colecao === 'simulador_produtos') {
      const res = await pb.collection('simulador_produtos').getList(1, 1, { fields: 'id' })
      totalInicial = res.totalItems
    } else {
      const res = await pb.collection('simulador_regras_icms').getList(1, 1, { fields: 'id' })
      totalInicial = res.totalItems
    }
  } catch (err) {
    console.error(`Erro ao contar total inicial para limpeza de ${colecao}:`, err)
  }

  if (totalInicial === 0) {
    if (onProgresso) {
      onProgresso({ apagados: 0, totalInicial: 0, emExecucao: false })
    }
    return { apagados: 0, falhas: 0 }
  }

  if (onProgresso) {
    onProgresso({
      apagados: 0,
      totalInicial,
      emExecucao: true,
    })
  }

  // 2. Chamar o hook rápido de servidor do simulador
  try {
    const res = await pb.send<RespostaLimparBaseServidor>('/backend/v1/simulador/limpar-base', {
      method: 'POST',
      body: {
        alvo: colecao,
        confirmar: 'LIMPAR',
      },
    })

    const apagados = typeof res?.apagados === 'number' ? res.apagados : totalInicial

    if (onProgresso) {
      onProgresso({
        apagados,
        totalInicial,
        emExecucao: false,
      })
    }

    return { apagados, falhas: 0 }
  } catch (serverErr: any) {
    console.warn(
      `Falha na rota rápida do servidor (/backend/v1/simulador/limpar-base) para ${colecao}:`,
      serverErr,
    )

    // Se o erro for de permissão (401/403) ou validação (400), propaga o erro imediatamente
    const status = serverErr?.status || serverErr?.response?.status
    const msg =
      serverErr?.response?.data?.error ||
      serverErr?.data?.error ||
      serverErr?.message ||
      'Erro ao executar limpeza no servidor'

    if (status === 401 || status === 403 || status === 400) {
      if (onProgresso) {
        onProgresso({ apagados: 0, totalInicial, emExecucao: false })
      }
      throw new Error(msg)
    }

    // Caso ocorra falha de rede ou rota temporariamente indisponível, fallback em lotes
    return executarLimpezaFallbackCliente(colecao, totalInicial, onProgresso)
  }
}

/**
 * Fallback resiliente: exclusão paginada em lote no cliente se a rota do servidor falhar
 */
async function executarLimpezaFallbackCliente(
  colecao: 'simulador_produtos' | 'simulador_regras_icms',
  totalInicial: number,
  onProgresso?: (progresso: {
    apagados: number
    totalInicial: number
    emExecucao: boolean
  }) => void,
): Promise<{ apagados: number; falhas: number }> {
  let totalApagados = 0
  let totalFalhas = 0
  const tamanhoLoteIds = 500

  while (true) {
    let idsLote: string[] = []

    try {
      if (colecao === 'simulador_produtos') {
        const pagina = await pb.collection('simulador_produtos').getList(1, tamanhoLoteIds, {
          fields: 'id',
        })
        idsLote = pagina.items.map((it) => it.id)
      } else {
        const pagina = await pb.collection('simulador_regras_icms').getList(1, tamanhoLoteIds, {
          fields: 'id',
        })
        idsLote = pagina.items.map((it) => it.id)
      }
    } catch (err) {
      console.error(`Erro ao buscar página de IDs no fallback de ${colecao}:`, err)
      break
    }

    if (idsLote.length === 0) break

    const resultadoLote = await executarExclusaoParalelaPorIds(
      colecao,
      idsLote,
      (p) => {
        if (onProgresso) {
          onProgresso({
            apagados: totalApagados + p.apagados,
            totalInicial,
            emExecucao: true,
          })
        }
      },
      totalInicial,
    )

    totalApagados += resultadoLote.sucesso
    totalFalhas += resultadoLote.falhas

    if (resultadoLote.sucesso === 0 && resultadoLote.falhas >= idsLote.length) {
      break
    }
  }

  if (onProgresso) {
    onProgresso({
      apagados: totalApagados,
      totalInicial,
      emExecucao: false,
    })
  }

  return { apagados: totalApagados, falhas: totalFalhas }
}

export const simuladorImportadorService = {
  // --------------------------------------------------------------------------
  // PRODUTOS: CRUD DIRETO
  // --------------------------------------------------------------------------
  async criarProduto(dados: Partial<SimProdutoBase>) {
    return pb.collection('simulador_produtos').create<SimProdutoBase>(dados)
  },

  async atualizarProduto(id: string, dados: Partial<SimProdutoBase>) {
    return pb.collection('simulador_produtos').update<SimProdutoBase>(id, dados)
  },

  async excluirProduto(id: string) {
    return pb.collection('simulador_produtos').delete(id)
  },

  async excluirProdutosEmMassa(ids: string[]): Promise<{ sucesso: number; falhas: number }> {
    return executarExclusaoParalelaPorIds('simulador_produtos', ids, undefined, ids.length)
  },

  /**
   * Obtém a contagem real e atualizada de registros de produtos na base simulador_produtos
   */
  async contarTotalProdutos(): Promise<number> {
    const res = await pb.collection('simulador_produtos').getList(1, 1, {
      fields: 'id',
    })
    return res.totalItems
  },

  /**
   * Limpa integralmente a base simulador_produtos via rota rápida do servidor:
   * - Execução direta no banco pelo servidor (POST /backend/v1/simulador/limpar-base)
   * - Resposta em segundos sem tráfego registro a registro
   * - Resiliente com fallback para exclusão client-side se necessário
   */
  async limparBaseProdutos(
    onProgresso?: (progresso: {
      apagados: number
      totalInicial: number
      emExecucao: boolean
    }) => void,
    _tamanhoLoteLegado?: number,
  ): Promise<{ apagados: number; falhas: number }> {
    return executarLimpezaBaseServidor('simulador_produtos', onProgresso)
  },

  async atualizarProdutosEmMassa(
    ids: string[],
    dados: Partial<SimProdutoBase>,
  ): Promise<{ sucesso: number; falhas: number }> {
    let sucesso = 0
    let falhas = 0
    for (const id of ids) {
      try {
        await pb.collection('simulador_produtos').update(id, dados)
        sucesso++
      } catch (err) {
        console.error(`Erro ao atualizar produto em massa ${id}:`, err)
        falhas++
      }
    }
    return { sucesso, falhas }
  },

  // --------------------------------------------------------------------------
  // REGRAS ICMS: CRUD DIRETO
  // --------------------------------------------------------------------------
  async criarRegraIcms(dados: Partial<SimRegraIcms>) {
    // Garante preenchimento de chave_origem_destino
    const ufOrig = (dados.uf_origem || '').toUpperCase().trim()
    const ufDest = (dados.uf_destino || '').toUpperCase().trim()
    const grTrib = (dados.grupo_tributario_codigo || '').trim()
    const idRegra = (dados.id_regra || '').trim()

    const chave = dados.chave_origem_destino || `${ufOrig}_${ufDest}_${grTrib}_${idRegra}`
    return pb.collection('simulador_regras_icms').create<SimRegraIcms>({
      ...dados,
      chave_origem_destino: chave,
    })
  },

  async atualizarRegraIcms(id: string, dados: Partial<SimRegraIcms>) {
    return pb.collection('simulador_regras_icms').update<SimRegraIcms>(id, dados)
  },

  async excluirRegraIcms(id: string) {
    return pb.collection('simulador_regras_icms').delete(id)
  },

  async excluirRegrasIcmsEmMassa(ids: string[]): Promise<{ sucesso: number; falhas: number }> {
    return executarExclusaoParalelaPorIds('simulador_regras_icms', ids, undefined, ids.length)
  },

  /**
   * Obtém a contagem real e atualizada de registros de regras fiscais na base simulador_regras_icms
   */
  async contarTotalRegrasIcms(): Promise<number> {
    const res = await pb.collection('simulador_regras_icms').getList(1, 1, {
      fields: 'id',
    })
    return res.totalItems
  },

  /**
   * Limpa integralmente a base simulador_regras_icms via rota rápida do servidor:
   * - Execução direta no banco pelo servidor (POST /backend/v1/simulador/limpar-base)
   * - Resposta em segundos sem tráfego registro a registro
   * - Resiliente com fallback para exclusão client-side se necessário
   */
  async limparBaseRegrasIcms(
    onProgresso?: (progresso: {
      apagados: number
      totalInicial: number
      emExecucao: boolean
    }) => void,
    _tamanhoLoteLegado?: number,
  ): Promise<{ apagados: number; falhas: number }> {
    return executarLimpezaBaseServidor('simulador_regras_icms', onProgresso)
  },

  async atualizarRegrasIcmsEmMassa(
    ids: string[],
    dados: Partial<SimRegraIcms>,
  ): Promise<{ sucesso: number; falhas: number }> {
    let sucesso = 0
    let falhas = 0
    for (const id of ids) {
      try {
        await pb.collection('simulador_regras_icms').update(id, dados)
        sucesso++
      } catch (err) {
        console.error(`Erro ao atualizar regra ICMS em massa ${id}:`, err)
        falhas++
      }
    }
    return { sucesso, falhas }
  },

  // --------------------------------------------------------------------------
  // UPSERT EM LOTE — BASE DE PRODUTOS
  // --------------------------------------------------------------------------
  async importarProdutosEmLote(
    itens: Record<string, any>[],
    mapaColunas: Record<string, string>,
    onProgresso?: (p: ProgressoLote) => void,
    batchSize = 25,
  ): Promise<ResultadoImportacao> {
    const res: ResultadoImportacao = {
      total: itens.length,
      criados: 0,
      atualizados: 0,
      falhas: 0,
      erros: [],
    }

    let processados = 0

    for (let i = 0; i < itens.length; i += batchSize) {
      const lote = itens.slice(i, i + batchSize)

      for (const item of lote) {
        processados++
        try {
          // Extrair campos de acordo com o mapeamento
          const payload: Record<string, any> = {}
          const extras: Record<string, any> = {}

          for (const [colunaPlanilha, campoDestino] of Object.entries(mapaColunas)) {
            if (!campoDestino || campoDestino === '__ignorar__') continue
            const val = item[colunaPlanilha]
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              payload[campoDestino] = val
            }
          }

          // Armazenar colunas não mapeadas em dados_extras
          for (const [col, val] of Object.entries(item)) {
            if (!mapaColunas[col] || mapaColunas[col] === '__ignorar__') {
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                extras[col] = val
              }
            }
          }

          const codigo = payload.codigo ? String(payload.codigo).trim() : ''
          const descricao = payload.descricao ? String(payload.descricao).trim() : ''

          if (!descricao && !codigo) {
            // Linha vazia ou sem identificação mínima — ignora
            continue
          }

          // Formatar tipos
          const registroFormatado: Partial<SimProdutoBase> = {
            codigo: codigo || undefined,
            descricao: descricao || (codigo ? `Produto ${codigo}` : 'Produto Sem Descrição'),
            ncm: payload.ncm ? String(payload.ncm).trim() : undefined,
            unidade: payload.unidade ? String(payload.unidade).trim() : 'UN',
            origem: payload.origem ? String(payload.origem).trim() : 'Nacional',
            tipo_produto: payload.tipo_produto ? String(payload.tipo_produto).trim() : undefined,
            embalagem: payload.embalagem ? String(payload.embalagem).trim() : undefined,
            principio_ativo: payload.principio_ativo
              ? String(payload.principio_ativo).trim()
              : undefined,
            fabricante: payload.fabricante ? String(payload.fabricante).trim() : undefined,
            moeda: payload.moeda ? String(payload.moeda).trim().toUpperCase() : 'BRL',
            preco_base_sugerido:
              payload.preco_base_sugerido !== undefined
                ? parseNumeroSeguro(payload.preco_base_sugerido)
                : 0,
            gr_trib: payload.gr_trib ? String(payload.gr_trib).trim() : undefined,
            grupo_codigo: payload.grupo_codigo ? String(payload.grupo_codigo).trim() : undefined,
            grupo_descricao: payload.grupo_descricao
              ? String(payload.grupo_descricao).trim()
              : undefined,
            descricao_grupo_tributario: payload.descricao_grupo_tributario
              ? String(payload.descricao_grupo_tributario).trim()
              : undefined,
            segmento: payload.segmento ? String(payload.segmento).trim() : undefined,
            comissao_padrao:
              payload.comissao_padrao !== undefined
                ? parseNumeroSeguro(payload.comissao_padrao)
                : 0,
            dados_extras: Object.keys(extras).length > 0 ? extras : undefined,
          }

          // Idempotência: busca se o registro já existe pelo código (chave principal) ou descrição
          let existente: any = null
          if (codigo) {
            const busca = await pb.collection('simulador_produtos').getList(1, 1, {
              filter: `codigo = '${codigo.replace(/'/g, "\\'")}'`,
            })
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (!existente && descricao) {
            const busca = await pb.collection('simulador_produtos').getList(1, 1, {
              filter: `descricao = '${descricao.replace(/'/g, "\\'")}'`,
            })
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (existente) {
            await pb.collection('simulador_produtos').update(existente.id, registroFormatado)
            res.atualizados++
          } else {
            await pb.collection('simulador_produtos').create(registroFormatado)
            res.criados++
          }
        } catch (itemErr: any) {
          res.falhas++
          const errMsg = itemErr?.message || String(itemErr)
          if (res.erros.length < 10) {
            res.erros.push(`Linha ${processados}: ${errMsg}`)
          }
        }
      }

      if (onProgresso) {
        onProgresso({
          processados,
          total: itens.length,
          criados: res.criados,
          atualizados: res.atualizados,
          falhas: res.falhas,
          mensagem: `Processando lote ${Math.min(itens.length, processados)} de ${itens.length}...`,
        })
      }
    }

    return res
  },

  // --------------------------------------------------------------------------
  // UPSERT EM LOTE — REGRAS FISCAIS (ICMS)
  // --------------------------------------------------------------------------
  async importarRegrasIcmsEmLote(
    itens: Record<string, any>[],
    mapaColunas: Record<string, string>,
    onProgresso?: (p: ProgressoLote) => void,
    batchSize = 25,
  ): Promise<ResultadoImportacao> {
    const res: ResultadoImportacao = {
      total: itens.length,
      criados: 0,
      atualizados: 0,
      falhas: 0,
      erros: [],
    }

    let processados = 0

    for (let i = 0; i < itens.length; i += batchSize) {
      const lote = itens.slice(i, i + batchSize)

      for (const item of lote) {
        processados++
        try {
          const payload: Record<string, any> = {}
          const extras: Record<string, any> = {}

          for (const [colunaPlanilha, campoDestino] of Object.entries(mapaColunas)) {
            if (!campoDestino || campoDestino === '__ignorar__') continue
            const val = item[colunaPlanilha]
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              payload[campoDestino] = val
            }
          }

          for (const [col, val] of Object.entries(item)) {
            if (!mapaColunas[col] || mapaColunas[col] === '__ignorar__') {
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                extras[col] = val
              }
            }
          }

          const ufOrigem = (
            payload.uf_origem ? String(payload.uf_origem).trim().toUpperCase() : ''
          ).slice(0, 2)
          const ufDestino = (
            payload.uf_destino ? String(payload.uf_destino).trim().toUpperCase() : ''
          ).slice(0, 2)

          if (!ufOrigem || !ufDestino) {
            // Requisito obrigatório
            continue
          }

          const idRegra = payload.id_regra ? String(payload.id_regra).trim() : ''
          const grTrib = payload.grupo_tributario_codigo
            ? String(payload.grupo_tributario_codigo).trim()
            : ''
          const chave = `${ufOrigem}_${ufDestino}_${grTrib}_${idRegra}`

          const aliquotaIcms = parseNumeroSeguro(payload.aliquota_icms)
          const reducaoBase = parseNumeroSeguro(payload.reducao_base)
          let aliquotaEfetiva = parseNumeroSeguro(payload.aliquota_efetiva)

          if (!aliquotaEfetiva && aliquotaIcms > 0) {
            aliquotaEfetiva = Number((aliquotaIcms * (1 - reducaoBase / 100)).toFixed(2))
          }

          const registroFormatado: Partial<SimRegraIcms> = {
            uf_origem: ufOrigem,
            uf_destino: ufDestino,
            aliquota_icms: aliquotaIcms,
            reducao_base: reducaoBase,
            aliquota_efetiva: aliquotaEfetiva,
            diferimento: parseBoolSeguro(payload.diferimento),
            percentual_diferimento: parseNumeroSeguro(payload.percentual_diferimento),
            fundamentacao_legal: payload.fundamentacao_legal
              ? String(payload.fundamentacao_legal).trim()
              : undefined,
            tipo_operacao: payload.tipo_operacao
              ? String(payload.tipo_operacao).trim()
              : 'Interestadual',
            chave_origem_destino: chave,
            id_regra: idRegra || undefined,
            tipo_uf_origem: payload.tipo_uf_origem
              ? String(payload.tipo_uf_origem).trim()
              : undefined,
            tipo_uf_destino: payload.tipo_uf_destino
              ? String(payload.tipo_uf_destino).trim()
              : undefined,
            grupo_tributario_codigo: grTrib || undefined,
            grupo_tributario_descricao: payload.grupo_tributario_descricao
              ? String(payload.grupo_tributario_descricao).trim()
              : undefined,
            prod_importado: payload.prod_importado
              ? String(payload.prod_importado).trim()
              : undefined,
            tipo_desonerado: payload.tipo_desonerado
              ? String(payload.tipo_desonerado).trim()
              : undefined,
            icms_desonerado: parseNumeroSeguro(payload.icms_desonerado),
            regra_credito_entrada: payload.regra_credito_entrada
              ? String(payload.regra_credito_entrada).trim()
              : undefined,
            dados_extras: Object.keys(extras).length > 0 ? extras : undefined,
          }

          // Idempotência de regras de ICMS: busca por chave composta
          let existente: any = null
          if (idRegra) {
            const busca = await pb.collection('simulador_regras_icms').getList(1, 1, {
              filter: `id_regra = '${idRegra.replace(/'/g, "\\'")}'`,
            })
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (!existente) {
            const filterChave = grTrib
              ? `uf_origem = '${ufOrigem}' && uf_destino = '${ufDestino}' && grupo_tributario_codigo = '${grTrib.replace(/'/g, "\\'")}'`
              : `uf_origem = '${ufOrigem}' && uf_destino = '${ufDestino}'`
            const busca = await pb.collection('simulador_regras_icms').getList(1, 1, {
              filter: filterChave,
            })
            if (busca.items.length > 0) existente = busca.items[0]
          }

          if (existente) {
            await pb.collection('simulador_regras_icms').update(existente.id, registroFormatado)
            res.atualizados++
          } else {
            await pb.collection('simulador_regras_icms').create(registroFormatado)
            res.criados++
          }
        } catch (itemErr: any) {
          res.falhas++
          const errMsg = itemErr?.message || String(itemErr)
          if (res.erros.length < 10) {
            res.erros.push(`Linha ${processados}: ${errMsg}`)
          }
        }
      }

      if (onProgresso) {
        onProgresso({
          processados,
          total: itens.length,
          criados: res.criados,
          atualizados: res.atualizados,
          falhas: res.falhas,
          mensagem: `Processando lote ${Math.min(itens.length, processados)} de ${itens.length}...`,
        })
      }
    }

    return res
  },

  // --------------------------------------------------------------------------
  // SUGESTÃO AUTOMÁTICA DE MAPEAMENTO DE COLUNAS
  // --------------------------------------------------------------------------
  sugerirMapeamento(
    colunasPlanilha: string[],
    tipo: 'produtos' | 'regras',
  ): Record<string, string> {
    const mapa: Record<string, string> = {}
    const camposRef = tipo === 'produtos' ? CAMPOS_PRODUTO_MAP : CAMPOS_REGRA_ICMS_MAP

    for (const col of colunasPlanilha) {
      const colNorm = normalizarNome(col)
      let match = ''

      for (const campo of camposRef) {
        if (normalizarNome(campo.key) === colNorm) {
          match = campo.key
          break
        }
        if (campo.aliases.some((alias) => colNorm.includes(alias) || alias.includes(colNorm))) {
          match = campo.key
          break
        }
      }

      mapa[col] = match || '__ignorar__'
    }

    return mapa
  },
}
