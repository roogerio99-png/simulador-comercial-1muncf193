/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Atualizar simulador_comercial_users: adicionar role (admin | analista) e ajustar API rules
    const usersCol = app.findCollectionByNameOrId('simulador_comercial_users')
    if (usersCol) {
      let hasRole = false
      for (const f of usersCol.fields) {
        if (f.name === 'role') {
          hasRole = true
          break
        }
      }
      if (!hasRole) {
        usersCol.fields.add(
          new SelectField({
            name: 'role',
            required: false,
            maxSelect: 1,
            values: ['admin', 'analista'],
          }),
        )
      }
      // Regras de acesso para usuários do simulador:
      // Usuários autenticados podem ver os perfis do simulador;
      // Edição apenas do próprio registro (sem auto-alterar role salvo por admin)
      usersCol.listRule =
        "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'"
      usersCol.viewRule =
        "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'"
      usersCol.updateRule =
        "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users' && id = @request.auth.id"
      app.save(usersCol)
    }

    // 2. Criar coleção convites_simulador para convites exclusivos do Simulador Comercial
    let convitesCol = null
    try {
      convitesCol = app.findCollectionByNameOrId('convites_simulador')
    } catch (_) {
      convitesCol = null
    }

    if (!convitesCol) {
      convitesCol = new Collection({
        name: 'convites_simulador',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'",
        viewRule:
          "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'",
        createRule:
          "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users' && @request.auth.role = 'admin'",
        updateRule:
          "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users' && @request.auth.role = 'admin'",
        deleteRule:
          "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users' && @request.auth.role = 'admin'",
        fields: [
          new TextField({
            name: 'email',
            required: true,
          }),
          new TextField({
            name: 'nome',
            required: false,
          }),
          new SelectField({
            name: 'role',
            required: true,
            maxSelect: 1,
            values: ['admin', 'analista'],
          }),
          new SelectField({
            name: 'status',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'aceito', 'cancelado'],
          }),
          new TextField({
            name: 'token_convite',
            required: true,
          }),
          new TextField({
            name: 'link_definicao_senha',
            required: false,
          }),
          new TextField({
            name: 'convidado_por',
            required: false,
          }),
        ],
        indexes: [
          'CREATE INDEX idx_convites_sim_email ON convites_simulador (email)',
          'CREATE INDEX idx_convites_sim_token ON convites_simulador (token_convite)',
          'CREATE INDEX idx_convites_sim_status ON convites_simulador (status)',
        ],
      })
      app.save(convitesCol)
    }
  },
  (app) => {
    try {
      const convites = app.findCollectionByNameOrId('convites_simulador')
      if (convites) {
        app.delete(convites)
      }
    } catch (_) {}
  },
)
