/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints específicos para o Simulador Comercial (PocketBase v0.23+ JSVM API):
 * - /backend/v1/simulador/setup-admin
 * - /backend/v1/simulador/usuarios
 * - /backend/v1/simulador/usuarios/convidar
 * - /backend/v1/simulador/usuarios/alterar-papel
 * - /backend/v1/simulador/usuarios/excluir
 */

routerAdd('POST', '/backend/v1/simulador/setup-admin', (e) => {
  const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const email = (data.email || 'admin@simulador.agro.com').toLowerCase().trim()
  const password = data.password || 'AdminAgro@2025!'
  const name = data.name || 'Administrador Simulador'

  try {
    const existing = $app.findAuthRecordByEmail('simulador_comercial_users', email)
    if (existing) {
      existing.set('role', 'admin')
      $app.save(existing)
      return e.json(200, {
        sucesso: true,
        mensagem: 'Usuário administrador já existia e teve papel admin garantido.',
        email: existing.getString('email'),
      })
    }
  } catch (_) {}

  const record = new Record(usersCol)
  record.set('email', email)
  record.set('password', password)
  record.set('name', name)
  record.set('role', 'admin')
  record.set('verified', true)
  $app.save(record)

  return e.json(200, {
    sucesso: true,
    mensagem: 'Primeiro administrador criado com sucesso!',
    email: record.getString('email'),
  })
})

routerAdd('GET', '/backend/v1/simulador/usuarios', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Acesso restrito ao Simulador Comercial.' })
  }

  try {
    const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
    const userRecords = $app.findRecordsByFilter(usersCol, '', '-created', 100, 0)

    const usuarios = userRecords.map((r) => ({
      id: r.id,
      name: r.getString('name'),
      email: r.getString('email'),
      role: r.getString('role') || 'analista',
      verified: r.getBool('verified'),
      created: r.getString('created'),
      updated: r.getString('updated'),
    }))

    const convitesCol = $app.findCollectionByNameOrId('convites_simulador')
    const conviteRecords = $app.findRecordsByFilter(
      convitesCol,
      "status = 'pendente'",
      '-created',
      100,
      0,
    )

    const convites = conviteRecords.map((cRecord) => ({
      id: cRecord.id,
      email: cRecord.getString('email'),
      nome: cRecord.getString('nome'),
      role: cRecord.getString('role') || 'analista',
      status: cRecord.getString('status') || 'pendente',
      token_convite: cRecord.getString('token_convite'),
      link_definicao_senha: cRecord.getString('link_definicao_senha'),
      convidado_por: cRecord.getString('convidado_por'),
      created: cRecord.getString('created'),
    }))

    return e.json(200, {
      sucesso: true,
      usuarios,
      convites,
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha ao listar usuários do simulador: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/usuarios/convidar', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Autenticação requerida.' })
  }

  const roleAuth = authRecord.getString('role')
  if (roleAuth !== 'admin') {
    return e.json(403, { sucesso: false, error: 'Apenas administradores podem convidar usuários.' })
  }

  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const email = (data.email || '').toLowerCase().trim()
  const nome = (data.nome || '').trim()
  const role = data.role === 'admin' ? 'admin' : 'analista'

  if (!email || email.indexOf('@') === -1) {
    return e.json(400, { sucesso: false, error: 'E-mail corporativo válido é obrigatório.' })
  }

  try {
    const existing = $app.findAuthRecordByEmail('simulador_comercial_users', email)
    if (existing) {
      return e.json(400, {
        sucesso: false,
        error: 'Este usuário já possui cadastro ativo no Simulador Comercial.',
      })
    }
  } catch (_) {}

  const senhaTemporaria = 'Agro@' + $security.randomString(8) + '!'
  const tokenConvite = $security.randomString(32)

  try {
    const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
    const novoUsuario = new Record(usersCol)
    novoUsuario.set('email', email)
    novoUsuario.set('password', senhaTemporaria)
    novoUsuario.set('name', nome || email.split('@')[0])
    novoUsuario.set('role', role)
    novoUsuario.set('verified', false)
    $app.save(novoUsuario)

    const convitesCol = $app.findCollectionByNameOrId('convites_simulador')
    const conviteRecord = new Record(convitesCol)
    conviteRecord.set('email', email)
    conviteRecord.set('nome', nome)
    conviteRecord.set('role', role)
    conviteRecord.set('status', 'pendente')
    conviteRecord.set('token_convite', tokenConvite)
    conviteRecord.set('link_definicao_senha', '/reset-password?token=' + tokenConvite)
    conviteRecord.set('convidado_por', authRecord.getString('email'))
    $app.save(conviteRecord)

    return e.json(200, {
      sucesso: true,
      mensagem: 'Convite registrado com sucesso para ' + email + '.',
      email_enviado: false,
      aviso_email: 'Utilize o link de primeiro acesso ou as credenciais temporárias.',
      usuario_id: novoUsuario.id,
      email: email,
      role: role,
      senha_temporaria: senhaTemporaria,
      link_primeiro_acesso: '/login?email=' + encodeURIComponent(email),
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha ao processar convite: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/usuarios/alterar-papel', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Autenticação requerida.' })
  }

  if (authRecord.getString('role') !== 'admin') {
    return e.json(403, { sucesso: false, error: 'Apenas administradores podem alterar papéis.' })
  }

  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const targetId = data.id
  const newRole = data.role === 'admin' ? 'admin' : 'analista'

  if (!targetId) {
    return e.json(400, { sucesso: false, error: 'ID do usuário não fornecido.' })
  }

  if (targetId === authRecord.id) {
    return e.json(400, { sucesso: false, error: 'Você não pode alterar seu próprio papel.' })
  }

  try {
    const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
    const target = $app.findRecordById(usersCol, targetId)
    target.set('role', newRole)
    $app.save(target)

    return e.json(200, {
      sucesso: true,
      mensagem:
        'Papel do usuário atualizado para ' +
        (newRole === 'admin' ? 'Administrador' : 'Analista') +
        '.',
    })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Erro ao atualizar papel: ' + (err.message || String(err)),
    })
  }
})

routerAdd('POST', '/backend/v1/simulador/usuarios/excluir', (e) => {
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, { sucesso: false, error: 'Autenticação requerida.' })
  }

  if (authRecord.getString('role') !== 'admin') {
    return e.json(403, {
      sucesso: false,
      error: 'Apenas administradores podem excluir usuários ou convites.',
    })
  }

  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const userId = data.id
  const conviteId = data.convite_id

  try {
    if (conviteId) {
      const convitesCol = $app.findCollectionByNameOrId('convites_simulador')
      const conviteRecord = $app.findRecordById(convitesCol, conviteId)
      $app.delete(conviteRecord)
      return e.json(200, { sucesso: true, mensagem: 'Convite cancelado e removido.' })
    }

    if (userId) {
      if (userId === authRecord.id) {
        return e.json(400, {
          sucesso: false,
          error: 'Não é permitido excluir sua própria conta logada.',
        })
      }
      const usersCol = $app.findCollectionByNameOrId('simulador_comercial_users')
      const targetUser = $app.findRecordById(usersCol, userId)
      $app.delete(targetUser)
      return e.json(200, { sucesso: true, mensagem: 'Usuário removido do sistema.' })
    }

    return e.json(400, { sucesso: false, error: 'Nenhum ID informado para exclusão.' })
  } catch (err) {
    return e.json(500, {
      sucesso: false,
      error: 'Falha na exclusão: ' + (err.message || String(err)),
    })
  }
})
