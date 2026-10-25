import pb from '@/lib/pocketbase/client'

export interface UsuarioSimulador {
  id: string
  name: string
  email: string
  role: 'admin' | 'analista'
  verified: boolean
  created: string
  updated: string
}

export interface ConviteSimulador {
  id: string
  email: string
  nome?: string
  role: 'admin' | 'analista'
  status: 'pendente' | 'aceito' | 'cancelado'
  token_convite: string
  link_definicao_senha?: string
  convidado_por?: string
  created: string
}

export const simuladorAdminService = {
  async listarUsuarios(): Promise<{
    sucesso: boolean
    usuarios: UsuarioSimulador[]
    convites: ConviteSimulador[]
    error?: string
  }> {
    return pb.send('/backend/v1/simulador/usuarios', { method: 'GET' })
  },

  async convidarUsuario(dados: {
    email: string
    nome?: string
    role?: 'admin' | 'analista'
  }): Promise<{
    sucesso: boolean
    mensagem: string
    email?: string
    role?: 'admin' | 'analista'
    senha_temporaria?: string
    link_primeiro_acesso?: string
    error?: string
  }> {
    return pb.send('/backend/v1/simulador/usuarios/convidar', {
      method: 'POST',
      body: dados,
    })
  },

  async alterarPapel(id: string, role: 'admin' | 'analista') {
    return pb.send<{ sucesso: boolean; mensagem: string; error?: string }>(
      '/backend/v1/simulador/usuarios/alterar-papel',
      {
        method: 'POST',
        body: { id, role },
      },
    )
  },

  async excluirUsuarioOuConvite(params: { id?: string; convite_id?: string }) {
    return pb.send<{ sucesso: boolean; mensagem: string; error?: string }>(
      '/backend/v1/simulador/usuarios/excluir',
      {
        method: 'POST',
        body: params,
      },
    )
  },
}
