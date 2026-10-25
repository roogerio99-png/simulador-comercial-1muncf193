/**
 * Types para o Simulador Comercial Independente
 */

export interface SimProdutoBase {
  id: string
  codigo?: string
  descricao: string
  ncm?: string
  unidade?: string
  tipo_produto?: string
  origem?: string
  embalagem?: string
  principio_ativo?: string
  fabricante?: string
  moeda?: string
  preco_base_sugerido?: number
  dados_extras?: Record<string, unknown>
  gr_trib?: string
  grupo_codigo?: string
  grupo_descricao?: string
  descricao_grupo_tributario?: string
  segmento?: string
  comissao_padrao?: number
  created?: string
  updated?: string
}

export interface SimRegraIcms {
  id: string
  uf_origem: string
  uf_destino: string
  aliquota_icms: number
  reducao_base?: number
  aliquota_efetiva?: number
  diferimento?: boolean
  percentual_diferimento?: number
  fundamentacao_legal?: string
  tipo_operacao?: string
  chave_origem_destino: string
  id_regra?: string
  tipo_uf_origem?: string
  tipo_uf_destino?: string
  grupo_tributario_codigo?: string
  grupo_tributario_descricao?: string
  prod_importado?: string
  tipo_desonerado?: string
  icms_desonerado?: number
  regra_credito_entrada?: string
  dados_extras?: Record<string, unknown>
  created?: string
  updated?: string
}

export interface ParametrizacaoFiscal {
  id: string
  ncm: string
  aliquota_pis: number
  aliquota_cofins: number
  regime: 'cumulativo' | 'nao_cumulativo'
  aliquota_ibs: number
  aliquota_cbs: number
  classificacao: string
  tributacao: string
}

export interface RegraNcmEmbalagem {
  id: string
  ncm: string
  descricao: string
  embalagens_permitidas: string[]
  regra_especial?: string
}

export interface DicionarioPrincipioAtivo {
  id: string
  principio_ativo: string
  principio_ativo_chave: string
  classe?: string
  grupo_quimico?: string
  concentracao_min?: number
  concentracao_max?: number
  unidade?: string
  status?: string
  ncm_padrao_referencia?: string
  regra_tipi_embalagem?: string
  nota_subpos_2?: string
}

export interface BaseMestreProduto {
  id: string
  nome_produto: string
  marca_padronizada?: string
  ncm?: string
  registro_mapa?: string
  principio_ativo?: string
  fabricante?: string
  concentracao?: number
  unidade?: string
  status_validacao?: string
  tipo_produto?: string
  macro_grupo?: string
}

export interface ItemSimulacaoSalva {
  id: string
  data: string
  produtoCodigo?: string
  produtoDescricao: string
  ncm: string
  ufOrigem: string
  ufDestino: string
  quantidade: number
  precoBaseUnitario: number
  margemLucroPerc: number
  frete: number
  incluirIbsCbs: boolean
  aliquotaIcms: number
  aliquotaPis: number
  aliquotaCofins: number
  aliquotaIbs: number
  aliquotaCbs: number
  valorBaseTotal: number
  valorMargemTotal: number
  valorFreteTotal: number
  valorIcmsTotal: number
  valorPisTotal: number
  valorCofinsTotal: number
  valorIbsTotal: number
  valorCbsTotal: number
  precoFinalUnitario: number
  precoFinalTotal: number
}
