/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const authRule =
      "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'"

    // 1. Coleção simulador_produtos (cópia própria e independente de produtos do simulador)
    let prodCol = null
    try {
      prodCol = app.findCollectionByNameOrId('simulador_produtos')
    } catch (_) {
      prodCol = null
    }

    if (!prodCol) {
      prodCol = new Collection({
        name: 'simulador_produtos',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { name: 'codigo', type: 'text', required: false },
          { name: 'descricao', type: 'text', required: true },
          { name: 'ncm', type: 'text', required: false },
          { name: 'unidade', type: 'text', required: false },
          { name: 'tipo_produto', type: 'text', required: false },
          { name: 'origem', type: 'text', required: false },
          { name: 'embalagem', type: 'text', required: false },
          { name: 'principio_ativo', type: 'text', required: false },
          { name: 'fabricante', type: 'text', required: false },
          { name: 'moeda', type: 'text', required: false },
          { name: 'preco_base_sugerido', type: 'number', required: false },
          { name: 'gr_trib', type: 'text', required: false },
          { name: 'grupo_codigo', type: 'text', required: false },
          { name: 'grupo_descricao', type: 'text', required: false },
          { name: 'descricao_grupo_tributario', type: 'text', required: false },
          { name: 'segmento', type: 'text', required: false },
          { name: 'comissao_padrao', type: 'number', required: false },
          { name: 'dados_extras', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sim_loc_prod_codigo ON simulador_produtos (codigo)',
          'CREATE INDEX idx_sim_loc_prod_ncm ON simulador_produtos (ncm)',
          'CREATE INDEX idx_sim_loc_prod_desc ON simulador_produtos (descricao)',
        ],
      })
      app.save(prodCol)
    }

    // 2. Coleção simulador_regras_icms (cópia própria e independente de regras de ICMS)
    let icmsCol = null
    try {
      icmsCol = app.findCollectionByNameOrId('simulador_regras_icms')
    } catch (_) {
      icmsCol = null
    }

    if (!icmsCol) {
      icmsCol = new Collection({
        name: 'simulador_regras_icms',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { name: 'uf_origem', type: 'text', required: true },
          { name: 'uf_destino', type: 'text', required: true },
          { name: 'aliquota_icms', type: 'number', required: false },
          { name: 'reducao_base', type: 'number', required: false },
          { name: 'aliquota_efetiva', type: 'number', required: false },
          { name: 'diferimento', type: 'bool', required: false },
          { name: 'percentual_diferimento', type: 'number', required: false },
          { name: 'fundamentacao_legal', type: 'text', required: false },
          { name: 'tipo_operacao', type: 'text', required: false },
          { name: 'chave_origem_destino', type: 'text', required: false },
          { name: 'id_regra', type: 'text', required: false },
          { name: 'tipo_uf_origem', type: 'text', required: false },
          { name: 'tipo_uf_destino', type: 'text', required: false },
          { name: 'grupo_tributario_codigo', type: 'text', required: false },
          { name: 'grupo_tributario_descricao', type: 'text', required: false },
          { name: 'prod_importado', type: 'text', required: false },
          { name: 'tipo_desonerado', type: 'text', required: false },
          { name: 'icms_desonerado', type: 'number', required: false },
          { name: 'regra_credito_entrada', type: 'text', required: false },
          { name: 'dados_extras', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sim_loc_icms_orig ON simulador_regras_icms (uf_origem)',
          'CREATE INDEX idx_sim_loc_icms_dest ON simulador_regras_icms (uf_destino)',
          'CREATE INDEX idx_sim_loc_icms_chave ON simulador_regras_icms (chave_origem_destino)',
        ],
      })
      app.save(icmsCol)
    }

    // 3. Coleção simulador_base_mestre (cópia local dos produtos validados/mestre)
    let mestreCol = null
    try {
      mestreCol = app.findCollectionByNameOrId('simulador_base_mestre')
    } catch (_) {
      mestreCol = null
    }

    if (!mestreCol) {
      mestreCol = new Collection({
        name: 'simulador_base_mestre',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { name: 'nome_produto', type: 'text', required: true },
          { name: 'marca_padronizada', type: 'text', required: false },
          { name: 'nome_completo', type: 'text', required: false },
          { name: 'ncm', type: 'text', required: false },
          { name: 'ncm_padrao', type: 'text', required: false },
          { name: 'ncm_especifica', type: 'text', required: false },
          { name: 'embalagem', type: 'text', required: false },
          { name: 'principio_ativo', type: 'text', required: false },
          { name: 'fabricante', type: 'text', required: false },
          { name: 'titular_fabricante', type: 'text', required: false },
          { name: 'registro_mapa', type: 'text', required: false },
          { name: 'status_validacao', type: 'text', required: false },
          { name: 'tipo_produto', type: 'text', required: false },
          { name: 'unidade', type: 'text', required: false },
          { name: 'macro_grupo', type: 'text', required: false },
          { name: 'sub_grupo', type: 'text', required: false },
          { name: 'status_pis_cofins', type: 'text', required: false },
          { name: 'aliquota_ate_mar2026', type: 'text', required: false },
          { name: 'aliquota_pos_abr2026_real', type: 'text', required: false },
          { name: 'aliquota_pos_abr2026_presumido', type: 'text', required: false },
          { name: 'cst_saida', type: 'text', required: false },
          { name: 'cst_entrada', type: 'text', required: false },
          { name: 'ibs_cbs_2027', type: 'text', required: false },
          { name: 'regra_tipi', type: 'text', required: false },
          { name: 'dados_classificacao', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sim_loc_mestre_nome ON simulador_base_mestre (nome_produto)',
          'CREATE INDEX idx_sim_loc_mestre_ncm ON simulador_base_mestre (ncm)',
          'CREATE INDEX idx_sim_loc_mestre_status ON simulador_base_mestre (status_validacao)',
        ],
      })
      app.save(mestreCol)
    }

    // 4. Coleção simulador_parametrizacao_fiscal (cópia local dos parâmetros fiscais)
    let paramCol = null
    try {
      paramCol = app.findCollectionByNameOrId('simulador_parametrizacao_fiscal')
    } catch (_) {
      paramCol = null
    }

    if (!paramCol) {
      paramCol = new Collection({
        name: 'simulador_parametrizacao_fiscal',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { name: 'ncm', type: 'text', required: true },
          { name: 'aliquota_pis', type: 'number', required: false },
          { name: 'aliquota_cofins', type: 'number', required: false },
          { name: 'regime', type: 'text', required: false },
          { name: 'aliquota_ibs', type: 'number', required: false },
          { name: 'aliquota_cbs', type: 'number', required: false },
          { name: 'classificacao', type: 'text', required: false },
          { name: 'tributacao', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_sim_loc_param_ncm ON simulador_parametrizacao_fiscal (ncm)',
        ],
      })
      app.save(paramCol)
    }

    // 5. Coleção simulador_regras_embalagem (cópia local de regras NCM e embalagens)
    let embCol = null
    try {
      embCol = app.findCollectionByNameOrId('simulador_regras_embalagem')
    } catch (_) {
      embCol = null
    }

    if (!embCol) {
      embCol = new Collection({
        name: 'simulador_regras_embalagem',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { name: 'ncm', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: false },
          { name: 'embalagens_permitidas', type: 'json', required: false },
          { name: 'regra_especial', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_sim_loc_emb_ncm ON simulador_regras_embalagem (ncm)'],
      })
      app.save(embCol)
    }

    // 6. Coleção simulador_principios_ativos (cópia local do dicionário de princípios ativos)
    let paCol = null
    try {
      paCol = app.findCollectionByNameOrId('simulador_principios_ativos')
    } catch (_) {
      paCol = null
    }

    if (!paCol) {
      paCol = new Collection({
        name: 'simulador_principios_ativos',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: authRule,
        updateRule: authRule,
        deleteRule: authRule,
        fields: [
          { name: 'principio_ativo', type: 'text', required: true },
          { name: 'principio_ativo_chave', type: 'text', required: false },
          { name: 'classe', type: 'text', required: false },
          { name: 'grupo_quimico', type: 'text', required: false },
          { name: 'concentracao_min', type: 'number', required: false },
          { name: 'concentracao_max', type: 'number', required: false },
          { name: 'unidade', type: 'text', required: false },
          { name: 'status', type: 'text', required: false },
          { name: 'ncm_padrao_referencia', type: 'text', required: false },
          { name: 'nota_subpos_2', type: 'text', required: false },
          { name: 'regra_tipi_embalagem', type: 'text', required: false },
          { name: 'enquadramento_pis_cofins', type: 'text', required: false },
          { name: 'cst_recomendado', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sim_loc_pa_nome ON simulador_principios_ativos (principio_ativo)',
          'CREATE INDEX idx_sim_loc_pa_chave ON simulador_principios_ativos (principio_ativo_chave)',
        ],
      })
      app.save(paCol)
    }
  },
  (app) => {
    const cols = [
      'simulador_principios_ativos',
      'simulador_regras_embalagem',
      'simulador_parametrizacao_fiscal',
      'simulador_base_mestre',
      'simulador_regras_icms',
      'simulador_produtos',
    ]
    for (const cName of cols) {
      try {
        const c = app.findCollectionByNameOrId(cName)
        if (c) app.delete(c)
      } catch (_) {}
    }
  },
)
