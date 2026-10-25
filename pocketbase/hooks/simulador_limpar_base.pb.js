/// <reference path="../pb_data/types.d.ts" />

/**
 * Hook de Servidor: Limpeza Rápida de Base do Simulador Comercial
 * Endpoint: POST /backend/v1/simulador/limpar-base
 *
 * REGRA DE SEGURANÇA ABSOLUTA:
 * - Apenas usuários autenticados da coleção 'simulador_comercial_users' com role = 'admin' podem executar.
 * - Nomes das coleções apagáveis são exclusivamente STRINGS LITERAIS ('simulador_produtos' e 'simulador_regras_icms').
 * - NENHUM nome de coleção pode vir de variável, parâmetro, concatenação ou interpolação de string.
 * - NENHUMA coleção de outro app (como as do projeto 'Validação de Cadastro') pode ser apagada aqui.
 * - Rejeita com 400 se o alvo não for exatamente um dos literais permitidos ou se confirmar !== 'LIMPAR'.
 */

routerAdd('POST', '/backend/v1/simulador/limpar-base', (e) => {
  // 1. Validação de autenticação
  const authRecord = e.auth
  if (!authRecord || authRecord.collection().name !== 'simulador_comercial_users') {
    return e.json(401, {
      sucesso: false,
      error: 'Autenticação requerida na plataforma do Simulador Comercial.',
    })
  }

  // 2. Validação de autorização (apenas Admin)
  const role = authRecord.getString('role')
  if (role !== 'admin') {
    return e.json(403, {
      sucesso: false,
      error: 'Apenas usuários com perfil Administrador podem executar a limpeza da base.',
    })
  }

  // 3. Leitura e validação dos parâmetros
  const info = e.requestInfo()
  const data = (info && info.body) || {}
  const alvo = typeof data.alvo === 'string' ? data.alvo.trim() : ''
  const confirmar = typeof data.confirmar === 'string' ? data.confirmar.trim() : ''

  if (confirmar !== 'LIMPAR') {
    return e.json(400, {
      sucesso: false,
      error: "Para prosseguir, o parâmetro 'confirmar' deve conter exatamente a palavra 'LIMPAR'.",
    })
  }

  let totalApagados = 0

  // 4. Exclusão rápida direta no banco utilizando STRINGS LITERAIS OBRIGATÓRIAS
  if (alvo === 'simulador_produtos') {
    try {
      const countRes = $app.db().newQuery('SELECT COUNT(*) AS total FROM simulador_produtos').one()
      totalApagados = (countRes && Number(countRes.total)) || 0

      $app.db().newQuery('DELETE FROM simulador_produtos').execute()

      return e.json(200, {
        sucesso: true,
        alvo: 'simulador_produtos',
        apagados: totalApagados,
        mensagem: 'Base de Produtos limpa com sucesso.',
      })
    } catch (err) {
      return e.json(500, {
        sucesso: false,
        error: 'Falha ao limpar produtos do simulador: ' + (err.message || String(err)),
      })
    }
  } else if (alvo === 'simulador_regras_icms') {
    try {
      const countRes = $app
        .db()
        .newQuery('SELECT COUNT(*) AS total FROM simulador_regras_icms')
        .one()
      totalApagados = (countRes && Number(countRes.total)) || 0

      $app.db().newQuery('DELETE FROM simulador_regras_icms').execute()

      return e.json(200, {
        sucesso: true,
        alvo: 'simulador_regras_icms',
        apagados: totalApagados,
        mensagem: 'Base de Regras Fiscais de ICMS limpa com sucesso.',
      })
    } catch (err) {
      return e.json(500, {
        sucesso: false,
        error: 'Falha ao limpar regras fiscais do simulador: ' + (err.message || String(err)),
      })
    }
  } else {
    // Alvo desconhecido ou não autorizado — recusa imediata
    return e.json(400, {
      sucesso: false,
      error:
        "Alvo inválido. Apenas as coleções 'simulador_produtos' e 'simulador_regras_icms' são permitidas para limpeza.",
    })
  }
})
