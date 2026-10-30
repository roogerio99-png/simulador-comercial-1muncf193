import pb from '@/lib/pocketbase/client'
import type {
  SimProdutoBase,
  SimRegraIcms,
  ParametrizacaoFiscal,
  RegraNcmEmbalagem,
  DicionarioPrincipioAtivo,
  BaseMestreProduto,
} from '@/types/simulador'

/**
 * Serviço de dados do Simulador Comercial.
 * Consome 100% das coleções locais e próprias deste app:
 * - simulador_produtos
 * - simulador_regras_icms
 * - simulador_base_mestre
 * - simulador_parametrizacao_fiscal
 * - simulador_regras_embalagem
 * - simulador_principios_ativos
 *
 * Autenticação e RLS são restritas a simulador_comercial_users.
 */
export const simuladorDataService = {
  // Produtos Próprios do Simulador (simulador_produtos)
  async listarProdutos(page = 1, perPage = 20, filter?: string, sort = 'codigo') {
    return pb.collection('simulador_produtos').getList<SimProdutoBase>(page, perPage, {
      filter,
      sort,
    })
  },

  async buscarProdutoPorCodigo(codigo: string) {
    const res = await pb.collection('simulador_produtos').getList<SimProdutoBase>(1, 1, {
      filter: `codigo = '${codigo.replace(/'/g, "\\'")}'`,
    })
    return res.items[0] || null
  },

  // Regras de ICMS Próprias do Simulador (simulador_regras_icms)
  async listarRegrasIcms(page = 1, perPage = 25, filter?: string, sort = 'uf_origem,uf_destino') {
    return pb.collection('simulador_regras_icms').getList<SimRegraIcms>(page, perPage, {
      filter,
      sort,
    })
  },

  async obterRegraIcms(ufOrigem: string, ufDestino: string, grTrib?: string) {
    const orig = ufOrigem.toUpperCase().trim()
    const dest = ufDestino.toUpperCase().trim()
    const grLimpo = (grTrib || '').trim()

    if (grLimpo) {
      const resExata = await pb.collection('simulador_regras_icms').getList<SimRegraIcms>(1, 1, {
        filter: `uf_origem = '${orig}' && uf_destino = '${dest}' && grupo_tributario_codigo = '${grLimpo.replace(/'/g, "\\'")}'`,
        sort: '-created',
      })
      if (resExata.items.length > 0) {
        return resExata.items[0]
      }
    }

    const resFallback = await pb.collection('simulador_regras_icms').getList<SimRegraIcms>(1, 1, {
      filter: `uf_origem = '${orig}' && uf_destino = '${dest}'`,
      sort: '-created',
    })
    return resFallback.items[0] || null
  },

  async listarProdutosBaseSimulador(options: {
    page?: number
    perPage?: number
    filter?: string
    sort?: string
  }): Promise<{ items: SimProdutoBase[]; totalItems: number; totalPages: number }> {
    const page = options.page || 1
    const perPage = options.perPage || 25
    const sort = options.sort || 'codigo'
    const filter = options.filter || ''

    const res = await pb.collection('simulador_produtos').getList<SimProdutoBase>(page, perPage, {
      filter,
      sort,
      requestKey: null,
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  },

  async listarTodosProdutosBaseSimulador(sort = 'descricao'): Promise<SimProdutoBase[]> {
    return pb.collection('simulador_produtos').getFullList<SimProdutoBase>({
      sort,
      batch: 500,
      requestKey: null,
    })
  },

  async listarRegrasIcmsSimulador(options: {
    page?: number
    perPage?: number
    filter?: string
    sort?: string
  }): Promise<{ items: SimRegraIcms[]; totalItems: number; totalPages: number }> {
    const page = options.page || 1
    const perPage = options.perPage || 25
    const sort = options.sort || 'uf_origem,uf_destino'
    const filter = options.filter || ''

    const res = await pb.collection('simulador_regras_icms').getList<SimRegraIcms>(page, perPage, {
      filter,
      sort,
      requestKey: null,
    })
    return {
      items: res.items,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    }
  },

  async atualizarProdutoBaseSimulador(
    id: string,
    data: Partial<SimProdutoBase>,
  ): Promise<SimProdutoBase> {
    return await pb.collection('simulador_produtos').update<SimProdutoBase>(id, data)
  },

  async excluirProdutoBaseSimulador(id: string): Promise<boolean> {
    return await pb.collection('simulador_produtos').delete(id)
  },

  // Parametrização Fiscal Local (simulador_parametrizacao_fiscal)
  async listarParametrizacaoFiscal(page = 1, perPage = 30, filter?: string, sort = 'ncm') {
    return pb
      .collection('simulador_parametrizacao_fiscal')
      .getList<ParametrizacaoFiscal>(page, perPage, {
        filter,
        sort,
      })
  },

  async obterParametrizacaoPorNcm(ncm: string) {
    const cleanNcm = ncm.replace(/\D/g, '')
    if (!cleanNcm) return null

    // Tenta formato sem pontuação ou com pontuação
    const res = await pb
      .collection('simulador_parametrizacao_fiscal')
      .getList<ParametrizacaoFiscal>(1, 1, {
        filter: `ncm ~ '${cleanNcm}'`,
      })
    return res.items[0] || null
  },

  // Base Mestre Local (simulador_base_mestre)
  async listarBaseMestre(page = 1, perPage = 20, filter?: string, sort = '-created') {
    return pb.collection('simulador_base_mestre').getList<BaseMestreProduto>(page, perPage, {
      filter,
      sort,
    })
  },

  // Regras NCM / Embalagem Local (simulador_regras_embalagem)
  async listarRegrasNcmEmbalagem(page = 1, perPage = 25, filter?: string, sort = 'ncm') {
    return pb.collection('simulador_regras_embalagem').getList<RegraNcmEmbalagem>(page, perPage, {
      filter,
      sort,
    })
  },

  // Princípios Ativos Local (simulador_principios_ativos)
  async listarPrincipiosAtivos(
    page = 1,
    perPage = 25,
    filter?: string,
    sort = 'principio_ativo_chave',
  ) {
    return pb
      .collection('simulador_principios_ativos')
      .getList<DicionarioPrincipioAtivo>(page, perPage, {
        filter,
        sort,
      })
  },
}
