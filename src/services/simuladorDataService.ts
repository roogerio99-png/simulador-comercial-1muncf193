import { readOnlyData } from '@/lib/readOnlyClient'
import type {
  SimProdutoBase,
  SimRegraIcms,
  ParametrizacaoFiscal,
  RegraNcmEmbalagem,
  DicionarioPrincipioAtivo,
  BaseMestreProduto,
} from '@/types/simulador'

export const simuladorDataService = {
  // Produtos Base (sim_produtos_base)
  async listarProdutos(page = 1, perPage = 20, filter?: string, sort = 'codigo') {
    return readOnlyData.getList<SimProdutoBase>('sim_produtos_base', page, perPage, {
      filter,
      sort,
    })
  },

  async buscarProdutoPorCodigo(codigo: string) {
    const res = await readOnlyData.getList<SimProdutoBase>('sim_produtos_base', 1, 1, {
      filter: `codigo = '${codigo.replace(/'/g, "\\'")}'`,
    })
    return res.items[0] || null
  },

  // Regras de ICMS (sim_regras_icms)
  async listarRegrasIcms(page = 1, perPage = 25, filter?: string, sort = 'uf_origem,uf_destino') {
    return readOnlyData.getList<SimRegraIcms>('sim_regras_icms', page, perPage, {
      filter,
      sort,
    })
  },

  async obterRegraIcms(ufOrigem: string, ufDestino: string, grTrib?: string) {
    const orig = ufOrigem.toUpperCase().trim()
    const dest = ufDestino.toUpperCase().trim()
    const grLimpo = (grTrib || '').trim()

    if (grLimpo) {
      const resExata = await readOnlyData.getList<SimRegraIcms>('sim_regras_icms', 1, 1, {
        filter: `uf_origem = '${orig}' && uf_destino = '${dest}' && grupo_tributario_codigo = '${grLimpo.replace(/'/g, "\\'")}'`,
        sort: '-created',
      })
      if (resExata.items.length > 0) {
        return resExata.items[0]
      }
    }

    const resFallback = await readOnlyData.getList<SimRegraIcms>('sim_regras_icms', 1, 1, {
      filter: `uf_origem = '${orig}' && uf_destino = '${dest}'`,
      sort: '-created',
    })
    return resFallback.items[0] || null
  },

  // Parametrização Fiscal (parametrizacao_fiscal)
  async listarParametrizacaoFiscal(page = 1, perPage = 30, filter?: string, sort = 'ncm') {
    return readOnlyData.getList<ParametrizacaoFiscal>('parametrizacao_fiscal', page, perPage, {
      filter,
      sort,
    })
  },

  async obterParametrizacaoPorNcm(ncm: string) {
    const cleanNcm = ncm.replace(/\D/g, '')
    if (!cleanNcm) return null

    // Tenta formato sem pontuação ou com pontuação
    const res = await readOnlyData.getList<ParametrizacaoFiscal>('parametrizacao_fiscal', 1, 1, {
      filter: `ncm ~ '${cleanNcm}'`,
    })
    return res.items[0] || null
  },

  // Base Mestre (base_mestre)
  async listarBaseMestre(page = 1, perPage = 20, filter?: string, sort = '-created') {
    return readOnlyData.getList<BaseMestreProduto>('base_mestre', page, perPage, {
      filter,
      sort,
    })
  },

  // Regras NCM / Embalagem
  async listarRegrasNcmEmbalagem(page = 1, perPage = 25, filter?: string, sort = 'ncm') {
    return readOnlyData.getList<RegraNcmEmbalagem>('regras_ncm_embalagem', page, perPage, {
      filter,
      sort,
    })
  },

  // Princípios Ativos
  async listarPrincipiosAtivos(
    page = 1,
    perPage = 25,
    filter?: string,
    sort = 'principio_ativo_chave',
  ) {
    return readOnlyData.getList<DicionarioPrincipioAtivo>(
      'dicionario_principios_ativos',
      page,
      perPage,
      {
        filter,
        sort,
      },
    )
  },
}
