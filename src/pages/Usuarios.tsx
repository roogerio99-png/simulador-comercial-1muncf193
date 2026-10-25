import React, { useState, useEffect } from 'react'
import {
  Users as UsersIcon,
  UserPlus,
  ShieldCheck,
  Eye,
  Trash2,
  RefreshCw,
  Loader2,
  Mail,
  Copy,
  Check,
  AlertCircle,
  KeyRound,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  simuladorAdminService,
  UsuarioSimulador,
  ConviteSimulador,
} from '@/services/simuladorAdminService'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function Usuarios() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [usuarios, setUsuarios] = useState<UsuarioSimulador[]>([])
  const [convites, setConvites] = useState<ConviteSimulador[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal Convidar
  const [modalConvidarAberto, setModalConvidarAberto] = useState(false)
  const [conviteNome, setConviteNome] = useState('')
  const [conviteEmail, setConviteEmail] = useState('')
  const [conviteRole, setConviteRole] = useState<'admin' | 'analista'>('analista')
  const [salvandoConvite, setSalvandoConvite] = useState(false)
  const [erroConvite, setErroConvite] = useState<string | null>(null)
  const [sucessoConviteData, setSucessoConviteData] = useState<{
    senhaTemporaria?: string
    email?: string
    link?: string
  } | null>(null)

  // Exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<{
    id?: string
    convite_id?: string
    nome: string
  } | null>(null)

  const carregarUsuarios = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await simuladorAdminService.listarUsuarios()
      if (res.sucesso) {
        setUsuarios(res.usuarios || [])
        setConvites(res.convites || [])
      } else {
        setError(res.error || 'Falha ao carregar lista de usuários')
      }
    } catch (err: any) {
      console.error('Erro ao listar usuários:', err)
      setError('Erro ao carregar usuários do simulador.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarUsuarios()
  }, [])

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!conviteEmail.trim() || !conviteEmail.includes('@')) {
      setErroConvite('Informe um e-mail corporativo válido.')
      return
    }

    setErroConvite(null)
    setSalvandoConvite(true)

    try {
      const res = await simuladorAdminService.convidarUsuario({
        email: conviteEmail.trim(),
        nome: conviteNome.trim() || undefined,
        role: conviteRole,
      })

      if (res.sucesso) {
        setSucessoConviteData({
          senhaTemporaria: res.senha_temporaria,
          email: res.email,
          link: res.link_primeiro_acesso,
        })
        carregarUsuarios()
        toast({
          title: 'Convite criado!',
          description: `Usuário ${res.email} registrado no Simulador Comercial.`,
        })
      } else {
        setErroConvite(res.error || 'Falha ao registrar convite.')
      }
    } catch (err: any) {
      setErroConvite(err?.data?.message || err?.message || 'Falha na requisição.')
    } finally {
      setSalvandoConvite(false)
    }
  }

  const handleAlterarPapel = async (id: string, novoPapel: 'admin' | 'analista') => {
    try {
      const res = await simuladorAdminService.alterarPapel(id, novoPapel)
      if (res.sucesso) {
        toast({
          title: 'Papel atualizado',
          description: res.mensagem,
        })
        carregarUsuarios()
      } else {
        toast({
          title: 'Erro',
          description: res.error || 'Não foi possível alterar o papel.',
          variant: 'destructive',
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err?.message || 'Falha ao atualizar.',
        variant: 'destructive',
      })
    }
  }

  const handleExcluirConfirmado = async () => {
    if (!itemParaExcluir) return
    try {
      const res = await simuladorAdminService.excluirUsuarioOuConvite({
        id: itemParaExcluir.id,
        convite_id: itemParaExcluir.convite_id,
      })
      if (res.sucesso) {
        toast({
          title: 'Removido com sucesso',
          description: res.mensagem,
        })
        carregarUsuarios()
      }
    } catch (err: any) {
      toast({
        title: 'Falha na exclusão',
        description: err?.message || 'Não foi possível remover o registro.',
        variant: 'destructive',
      })
    } finally {
      setItemParaExcluir(null)
    }
  }

  const copiarParaTransferencia = (texto: string) => {
    navigator.clipboard.writeText(texto)
    toast({
      title: 'Copiado!',
      description: 'Texto copiado para a área de transferência.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-[#1D6A43]" />
            Gerenciamento de Usuários & Convites
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Controle de acessos exclusivo da coleção <code>simulador_comercial_users</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarUsuarios}
            disabled={loading}
            className="h-8 gap-1.5 text-xs border-[#E4EAE5] text-[#1E2A24]"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#1D6A43] ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSucessoConviteData(null)
              setConviteEmail('')
              setConviteNome('')
              setConviteRole('analista')
              setErroConvite(null)
              setModalConvidarAberto(true)
            }}
            className="h-8 gap-1.5 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Convidar Usuário
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-[#C0392B] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabela de Usuários Ativos */}
      <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
        <CardHeader className="p-4 bg-[#FAFBF9] border-b border-[#E4EAE5]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-[#1E2A24]">
                Usuários Ativos do Simulador ({usuarios.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Contas com login habilitado na base de usuários do simulador
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto min-h-[160px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">Nome / Usuário</th>
                  <th className="py-3 px-3">E-mail</th>
                  <th className="py-3 px-3">Papel de Acesso</th>
                  <th className="py-3 px-3">Verificado</th>
                  <th className="py-3 px-3">Data Cadastro</th>
                  <th className="py-3 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-[#1D6A43]" />
                      Carregando usuários...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Nenhum usuário ativo registrado no momento.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => {
                    const isCurrentUser = u.id === user?.id
                    return (
                      <tr key={u.id} className="hover:bg-[#F7F9F6] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#1E2A24]">
                          {u.name || 'Sem nome'}
                          {isCurrentUser && (
                            <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              Você
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{u.email}</td>
                        <td className="py-2.5 px-3">
                          {isCurrentUser ? (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300">
                              {u.role === 'admin' ? 'Administrador' : 'Analista'}
                            </Badge>
                          ) : (
                            <Select
                              value={u.role}
                              onValueChange={(val: any) => handleAlterarPapel(u.id, val)}
                            >
                              <SelectTrigger className="h-7 w-32 text-[11px] border-[#E4EAE5]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="analista">Analista</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {u.verified ? (
                            <span className="text-[11px] text-emerald-700 font-semibold">Sim</span>
                          ) : (
                            <span className="text-[11px] text-amber-700">Pendente</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63] text-[11px]">
                          {new Date(u.created).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!isCurrentUser && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setItemParaExcluir({
                                  id: u.id,
                                  nome: u.name || u.email,
                                })
                              }
                              className="h-7 px-2 text-[11px] text-[#C0392B] hover:bg-red-50"
                              title="Remover usuário"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Convites Pendentes */}
      {convites.length > 0 && (
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-4 bg-[#FAFBF9] border-b border-[#E4EAE5]">
            <CardTitle className="text-sm font-bold text-[#1E2A24]">
              Convites Pendentes ({convites.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Convites emitidos aguardando definição de senha ou confirmação
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">E-mail Convidado</th>
                    <th className="py-3 px-3">Nome</th>
                    <th className="py-3 px-3">Papel Previsto</th>
                    <th className="py-3 px-3">Convidado Por</th>
                    <th className="py-3 px-3">Data Envio</th>
                    <th className="py-3 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {convites.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F7F9F6] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-[#1E2A24]">
                        {c.email}
                      </td>
                      <td className="py-2.5 px-3 text-[#5D6B63]">{c.nome || '—'}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] bg-slate-50">
                          {c.role === 'admin' ? 'Administrador' : 'Analista'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-[#5D6B63]">{c.convidado_por || 'Admin'}</td>
                      <td className="py-2.5 px-3 text-[#5D6B63] text-[11px]">
                        {new Date(c.created).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setItemParaExcluir({
                              convite_id: c.id,
                              nome: c.email,
                            })
                          }
                          className="h-7 px-2 text-[11px] text-[#C0392B] hover:bg-red-50"
                        >
                          Cancelar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Convidar Usuário */}
      <Dialog open={modalConvidarAberto} onOpenChange={setModalConvidarAberto}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#1E2A24]">
              {sucessoConviteData ? 'Convite Gerado com Sucesso!' : 'Convidar Novo Usuário'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5D6B63]">
              {sucessoConviteData
                ? 'Compartilhe as credenciais provisórias com o novo membro da equipe'
                : 'O usuário terá acesso restrito exclusivamente ao Simulador Comercial'}
            </DialogDescription>
          </DialogHeader>

          {sucessoConviteData ? (
            <div className="space-y-4 text-xs pt-1">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800">E-mail:</span>
                  <p className="font-mono">{sucessoConviteData.email}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Senha Provisória Gerada:
                  </span>
                  <div className="flex items-center justify-between bg-white p-2 rounded border border-emerald-300 mt-1">
                    <span className="font-mono font-bold text-sm text-[#1E2A24]">
                      {sucessoConviteData.senhaTemporaria}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        copiarParaTransferencia(sucessoConviteData.senhaTemporaria || '')
                      }
                      className="h-6 px-2 text-[11px] text-[#1D6A43]"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => setModalConvidarAberto(false)}
                  className="w-full bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs h-8"
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleConvidar} className="space-y-3 text-xs">
              {erroConvite && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C0392B] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{erroConvite}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nome Completo</Label>
                <Input
                  value={conviteNome}
                  onChange={(e) => setConviteNome(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">E-mail Corporativo</Label>
                <Input
                  type="email"
                  value={conviteEmail}
                  onChange={(e) => setConviteEmail(e.target.value)}
                  placeholder="joao@empresa.com.br"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nível de Acesso</Label>
                <Select value={conviteRole} onValueChange={(val: any) => setConviteRole(val)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="analista">
                      Analista Comercial (Simulações e Consultas)
                    </SelectItem>
                    <SelectItem value="admin">Administrador (Acesso Total e Convites)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalConvidarAberto(false)}
                  className="h-8 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoConvite}
                  className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
                >
                  {salvandoConvite ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Gerar Convite
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={Boolean(itemParaExcluir)} onOpenChange={() => setItemParaExcluir(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-[#1E2A24]">
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#5D6B63]">
              Deseja remover {itemParaExcluir?.nome} do Simulador Comercial? O acesso será revogado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirConfirmado}
              className="bg-[#C0392B] hover:bg-red-800 text-white text-xs h-8"
            >
              Sim, Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Usuarios
