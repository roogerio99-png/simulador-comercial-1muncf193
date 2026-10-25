/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('simulador_comercial_users')
    if (!usersCol) return

    // Criar o usuário padrão caso ainda não exista
    try {
      const existing = app.findAuthRecordByEmail(
        'simulador_comercial_users',
        'admin@simulador.agro.com',
      )
      if (existing) {
        existing.set('role', 'admin')
        app.save(existing)
        return
      }
    } catch (_) {}

    const admin = new Record(usersCol)
    admin.set('email', 'admin@simulador.agro.com')
    admin.set('password', 'AdminAgro@2025!')
    admin.set('name', 'Administrador Agro')
    admin.set('role', 'admin')
    admin.set('verified', true)
    app.save(admin)
  },
  (app) => {},
)
