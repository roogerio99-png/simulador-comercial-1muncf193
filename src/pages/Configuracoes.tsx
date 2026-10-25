import React, { useState } from 'react'
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Info,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  KeyRound,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import pb from '@/lib/pocketbase/client'
import { simulacoesStorage } from '@/lib/simulacoesStorage'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

export function Configuracoes() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()

  // Modal Alterar Senha
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [senhaAntiga, setSenhaAntiga] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaNovaConfirm, setSenhaNovaConfirm] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [erroSenha, setErroSenha] = useState<string | null>(null)

  // Modal Alterar E-mail
  const [modalEmailAberto, setModalEmailAberto] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)
  const [erroEmail, setErroEmail] = useState<string | null>(null)

  // Limpar dados locais
  const [alertaLimparAberto, setAlertaLimparAberto] = useState(false)

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!senhaAntiga) {
      setErroSenha('Informe sua senha atual.')
      return
    }
    if (senhaNova.length < 8) {
      setErroSenha('A nova senha deve ter pelo menos 8 dígitos.')
      return
    }
    if (senhaNova !== senhaNovaConfirm) {
      setErroSenha('As novas senhas não coincidem.')
      return
    }

    setErroSenha(null)
    setSalvandoSenha(true)
    try {
      if (!user) throw new Error('Usuário não autenticado')
      await pb.collection('simulador_comercial_users').update(user.id, {
        oldPassword: senhaAntiga,
        password: senhaNova,
        passwordConfirm: senhaNovaConfirm,
      })

      setModalSenhaAberto(false)
      setSenhaAntiga('')
      setSenhaNova('')
      setSenhaNovaConfirm('')

      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua credencial de acesso foi atualizada no Simulador.',
      })
    } catch (err: any) {
      setErroSenha(
        err?.data?.message || err?.message || 'Falha ao atualizar senha. Verifique a senha atual.',
      )
    } finally {
      setSalvandoSenha(false)
    }
  }

  const handleSolicitarTrocaEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoEmail || !novoEmail.includes('@')) {
      setErroEmail('Informe um e-mail válido.')
      return
    }

    setErroEmail(null)
    setSalvandoEmail(true)
    try {
      await pb.collection('simulador_comercial_users').requestEmailChange(novoEmail.trim())
      setModalEmailAberto(false)
      setNovoEmail('')
      toast({
        title: 'Solicitação enviada!',
        description: `Enviamos uma confirmação para ${novoEmail}. Verifique sua caixa de entrada.`,
      })
    } catch (err: any) {
      setErroEmail(
        err?.data?.message || err?.message || 'Não foi possível solicitar a alteração de e-mail.',
      )
    } finally {
      setSalvandoEmail(false)
    }
  }

  const handleLimparDadosLocais = () => {
    simulacoesStorage.limparTodas()
    setAlertaLimparAberto(false)
    toast({
      title: 'Histórico local apagado',
      description: 'Todas as simulações em cache deste navegador foram removidas.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-[#1D6A43]" />
            Configurações da Conta
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Gerenciamento do perfil de acesso, credenciais e armazenamento de dados locais.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Seção 1: Perfil do Usuário */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
              <User className="w-4 h-4 text-[#1D6A43]" />
              Perfil do Usuário
            </CardTitle>
            <CardDescription className="text-xs">
              Informações associadas à sua conta no Simulador Comercial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold">Nome Completo:</span>
              <p className="font-semibold text-sm text-[#1E2A24]">
                {user?.name || 'Não informado'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold">E-mail de Acesso:</span>
              <p className="font-medium text-[#1E2A24]">{user?.email}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 text-[11px] font-semibold">Nível de Permissão:</span>
              <div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    user?.role === 'admin'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-sky-50 text-sky-800 border-sky-300'
                  }`}
                >
                  {user?.role === 'admin' ? 'Administrador do Simulador' : 'Analista Comercial'}
                </Badge>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalEmailAberto(true)}
                className="text-xs h-8 border-[#E4EAE5] gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-[#1D6A43]" />
                Alterar E-mail
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seção 2: Segurança */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1D6A43]" />
              Segurança & Senha
            </CardTitle>
            <CardDescription className="text-xs">
              Mantenha suas credenciais sempre seguras e atualizadas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <p className="text-[#5D6B63] leading-relaxed">
              Sua senha protege o acesso ao motor de simulação, tabelas fiscais e histórico.
              Recomendamos a alteração periódica utilizando caracteres fortes.
            </p>

            <div className="pt-1">
              <Button
                onClick={() => setModalSenhaAberto(true)}
                className="bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs h-8 gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Alterar Minha Senha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seção 3: Sobre o Simulador e Dados Locais */}
        <Card className="md:col-span-2 rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#1D6A43]" />
              Sobre a Aplicação & Armazenamento Local
            </CardTitle>
            <CardDescription className="text-xs">
              Informações do sistema independente e controle de armazenamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 rounded-xl bg-[#FAFBF9] border border-[#E4EAE5]">
              <div>
                <span className="text-slate-500 text-[11px]">Versão do Simulador:</span>
                <p className="font-bold text-[#1E2A24]">v1.0.0 (Independente)</p>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Ambiente de Dados:</span>
                <p className="font-medium text-[#1E2A24]">Leitura direta da base mestre central</p>
              </div>
              <div>
                <span className="text-slate-500 text-[11px]">Coleção de Auth:</span>
                <p className="font-mono text-emerald-800">simulador_comercial_users</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h4 className="font-semibold text-[#1E2A24]">Limpar Dados em Cache</h4>
                <p className="text-[11px] text-[#5D6B63]">
                  Remove simulações gravadas localmente no navegador deste dispositivo.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setAlertaLimparAberto(true)}
                className="bg-[#C0392B] hover:bg-red-800 text-white text-xs h-8 gap-1.5 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Dados Locais
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Alterar Senha */}
      <Dialog open={modalSenhaAberto} onOpenChange={setModalSenhaAberto}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#1E2A24]">
              Alterar Senha de Acesso
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5D6B63]">
              Informe sua senha atual e escolha uma nova com no mínimo 8 dígitos.
            </DialogDescription>
          </DialogHeader>

          {erroSenha && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C0392B] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroSenha}</span>
            </div>
          )}

          <form onSubmit={handleAlterarSenha} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Senha Atual</Label>
              <Input
                type="password"
                value={senhaAntiga}
                onChange={(e) => setSenhaAntiga(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nova Senha (mín. 8 caracteres)</Label>
              <Input
                type="password"
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Confirmar Nova Senha</Label>
              <Input
                type="password"
                value={senhaNovaConfirm}
                onChange={(e) => setSenhaNovaConfirm(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalSenhaAberto(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoSenha}
                className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
              >
                {salvandoSenha ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Salvar Nova Senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Alterar E-mail */}
      <Dialog open={modalEmailAberto} onOpenChange={setModalEmailAberto}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#1E2A24]">Alterar E-mail</DialogTitle>
            <DialogDescription className="text-xs text-[#5D6B63]">
              Um e-mail com link de confirmação será enviado para o novo endereço.
            </DialogDescription>
          </DialogHeader>

          {erroEmail && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C0392B] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erroEmail}</span>
            </div>
          )}

          <form onSubmit={handleSolicitarTrocaEmail} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Novo E-mail Corporativo</Label>
              <Input
                type="email"
                placeholder="novo.email@empresa.com.br"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalEmailAberto(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvandoEmail}
                className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
              >
                {salvandoEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Enviar Confirmação
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação Limpar Dados */}
      <AlertDialog open={alertaLimparAberto} onOpenChange={setAlertaLimparAberto}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-[#1E2A24]">
              Limpar todas as simulações locais?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#5D6B63]">
              Essa ação excluirá todas as simulações salvas no armazenamento local do seu navegador.
              As regras de ICMS e tabelas centrais não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLimparDadosLocais}
              className="bg-[#C0392B] hover:bg-red-800 text-white text-xs h-8"
            >
              Sim, Limpar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Configuracoes
