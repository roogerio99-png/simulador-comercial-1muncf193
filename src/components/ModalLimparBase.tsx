import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertTriangle, Trash2, Loader2, Database, ShieldAlert, CheckCircle2 } from 'lucide-react'

interface ModalLimparBaseProps {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  nomeEntidade: string // Ex: "Produtos do Simulador" ou "Regras de ICMS"
  nomeColecao: string // Ex: "simulador_produtos" ou "simulador_regras_icms"
  isAdmin: boolean
  aoObterContagem: () => Promise<number>
  aoConfirmarLimpeza: (
    onProgresso: (p: { apagados: number; totalInicial: number; emExecucao: boolean }) => void,
  ) => Promise<{ apagados: number; falhas: number }>
  aoSucesso: (resultado: { apagados: number; falhas: number }) => void
}

export function ModalLimparBase({
  aberto,
  onOpenChange,
  nomeEntidade,
  nomeColecao,
  isAdmin,
  aoObterContagem,
  aoConfirmarLimpeza,
  aoSucesso,
}: ModalLimparBaseProps) {
  const [totalRegistros, setTotalRegistros] = useState<number | null>(null)
  const [carregandoContagem, setCarregandoContagem] = useState(false)
  const [textoConfirmacao, setTextoConfirmacao] = useState('')
  const [cienteCheckbox, setCienteCheckbox] = useState(false)
  const [executando, setExecutando] = useState(false)
  const [progresso, setProgresso] = useState<{
    apagados: number
    totalInicial: number
    emExecucao: boolean
  }>({
    apagados: 0,
    totalInicial: 0,
    emExecucao: false,
  })
  const [erro, setErro] = useState<string | null>(null)

  // Ao abrir o modal, busca a contagem em tempo real e reseta o formulário
  useEffect(() => {
    if (aberto) {
      setTextoConfirmacao('')
      setCienteCheckbox(false)
      setErro(null)
      setProgresso({ apagados: 0, totalInicial: 0, emExecucao: false })
      setCarregandoContagem(true)
      aoObterContagem()
        .then((qtd) => {
          setTotalRegistros(qtd)
        })
        .catch((err) => {
          console.error('Erro ao obter contagem da coleção:', err)
          setTotalRegistros(null)
          setErro('Não foi possível verificar a contagem atual de registros.')
        })
        .finally(() => {
          setCarregandoContagem(false)
        })
    }
  }, [aberto, aoObterContagem])

  const confirmacaoValida =
    isAdmin &&
    textoConfirmacao.trim().toUpperCase() === 'LIMPAR' &&
    cienteCheckbox &&
    !executando &&
    (totalRegistros === null || totalRegistros > 0)

  const handleLimpar = async () => {
    if (!isAdmin) {
      setErro('Apenas usuários com perfil Administrador têm autorização para limpar a base.')
      return
    }

    if (!confirmacaoValida) return

    setExecutando(true)
    setErro(null)

    try {
      const res = await aoConfirmarLimpeza((p) => {
        setProgresso(p)
      })

      onOpenChange(false)
      aoSucesso(res)
    } catch (err: any) {
      console.error('Erro ao executar limpeza total da base:', err)
      setErro(
        err?.message || 'Falha ao executar limpeza da base. Verifique sua conexão e permissões.',
      )
    } finally {
      setExecutando(false)
    }
  }

  const percentualProgresso =
    progresso.totalInicial > 0
      ? Math.min(100, Math.round((progresso.apagados / progresso.totalInicial) * 100))
      : 0

  return (
    <Dialog
      open={aberto}
      onOpenChange={(val) => {
        if (!executando) onOpenChange(val)
      }}
    >
      <DialogContent className="max-w-lg border-red-200">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
            Limpar Base Inteira — {nomeEntidade}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 pt-1">
            Esta ação apaga <strong>todos os registros</strong> da coleção{' '}
            <code className="font-mono text-red-700 font-bold bg-red-50 px-1 py-0.5 rounded">
              {nomeColecao}
            </code>
            , independentemente de paginação, filtros ou seleção.
          </DialogDescription>
        </DialogHeader>

        {!isAdmin ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Acesso Restrito ao Perfil Administrador</p>
              <p className="mt-1 text-slate-600">
                Usuários com perfil de Analista têm permissão apenas para consultas e edições
                operacionais. Para limpar a base de dados do simulador comercial, solicite a um
                Administrador da plataforma.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-xs">
            {/* Contagem em tempo real */}
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-950 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-red-600" />
                  Total de registros na base no servidor:
                </span>
                {carregandoContagem ? (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Consultando...
                  </span>
                ) : (
                  <span className="text-base font-bold font-mono text-red-700">
                    {totalRegistros !== null ? totalRegistros.toLocaleString('pt-BR') : '—'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-red-700/80">
                Nenhum dado das coleções do projeto Validação de Cadastro será tocado. Apenas a
                coleção própria deste app ({nomeColecao}) será esvaziada.
              </p>
            </div>

            {totalRegistros === 0 && !carregandoContagem && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>A base já se encontra vazia. Não há registros a serem apagados.</span>
              </div>
            )}

            {/* Aviso de irrevogabilidade */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
              <p className="font-medium text-slate-800">Atenção aos efeitos da limpeza:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>Todos os itens e regras cadastrados serão removidos permanentemente.</li>
                <li>Simulações salvas no histórico não são afetadas.</li>
                <li>
                  Você poderá reimportar ou recadastrar produtos e regras a qualquer momento via
                  Importador ou planilha.
                </li>
              </ul>
            </div>

            {/* Progresso durante a execução */}
            {executando && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-700" />
                    Apagando registros em lotes...
                  </span>
                  <span>{percentualProgresso}%</span>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-amber-600 h-2 transition-all duration-200"
                    style={{ width: `${percentualProgresso}%` }}
                  />
                </div>
                <p className="text-[11px] text-amber-800 text-center font-mono">
                  {progresso.apagados.toLocaleString('pt-BR')} de{' '}
                  {progresso.totalInicial.toLocaleString('pt-BR')} registros excluídos
                </p>
              </div>
            )}

            {/* Confirmação explícita */}
            {!executando && totalRegistros !== 0 && (
              <div className="space-y-3 pt-1">
                <div className="flex items-start space-x-2 pt-1">
                  <Checkbox
                    id="ciente-limpeza"
                    checked={cienteCheckbox}
                    onCheckedChange={(c) => setCienteCheckbox(Boolean(c))}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="ciente-limpeza"
                    className="text-xs text-slate-700 leading-tight cursor-pointer select-none font-medium"
                  >
                    Estou ciente de que esta ação é irreversível e excluirá permanentemente todos os{' '}
                    <strong>{totalRegistros?.toLocaleString('pt-BR') || ''}</strong> registros desta
                    base.
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-800">
                    Digite a palavra{' '}
                    <span className="text-red-600 font-mono font-bold">LIMPAR</span> para habilitar
                    a confirmação:
                  </label>
                  <Input
                    value={textoConfirmacao}
                    onChange={(e) => setTextoConfirmacao(e.target.value)}
                    placeholder="LIMPAR"
                    className="h-9 text-xs font-mono uppercase tracking-wider border-red-200 focus-visible:ring-red-500"
                    disabled={executando}
                  />
                </div>
              </div>
            )}

            {erro && (
              <div className="p-2.5 rounded-lg bg-red-100 border border-red-300 text-red-800 text-xs">
                {erro}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={executando}
            className="h-8 text-xs"
          >
            {isAdmin ? 'Cancelar' : 'Fechar'}
          </Button>

          {isAdmin && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleLimpar}
              disabled={!confirmacaoValida || executando || totalRegistros === 0}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {executando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Limpando base...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirmar Limpeza Total
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
