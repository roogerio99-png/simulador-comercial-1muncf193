/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
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
      usersCol.listRule =
        "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'"
      usersCol.viewRule =
        "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users'"
      usersCol.updateRule =
        "@request.auth.id != '' && @request.auth.collectionName = 'simulador_comercial_users' && id = @request.auth.id"
      app.save(usersCol)
    }

    // Verificar se convites_simulador tem os campos
    let convitesCol = app.findCollectionByNameOrId('convites_simulador')
    if (convitesCol) {
      let hasEmail = false
      for (const f of convitesCol.fields) {
        if (f.name === 'email') {
          hasEmail = true
          break
        }
      }
      if (!hasEmail) {
        convitesCol.fields.add(new TextField({ name: 'email', required: true }))
        convitesCol.fields.add(new TextField({ name: 'nome', required: false }))
        convitesCol.fields.add(
          new SelectField({
            name: 'role',
            required: true,
            maxSelect: 1,
            values: ['admin', 'analista'],
          }),
        )
        convitesCol.fields.add(
          new SelectField({
            name: 'status',
            required: true,
            maxSelect: 1,
            values: ['pendente', 'aceito', 'cancelado'],
          }),
        )
        convitesCol.fields.add(new TextField({ name: 'token_convite', required: true }))
        convitesCol.fields.add(new TextField({ name: 'link_definicao_senha', required: false }))
        convitesCol.fields.add(new TextField({ name: 'convidado_por', required: false }))
        app.save(convitesCol)
      }
    }
  },
  (app) => {},
)
