import React, { useState, useEffect, useCallback } from 'react'
import {
  FileStack,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Scale,
  Sparkles,
  BookOpen,
  Layers,
  Loader2,
} from 'lucide-react'
import { simuladorDataService } from '@/services/simuladorDataService'
import { simuladorImportadorService } from '@/services/simuladorImportadorService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CheckSquare,
  Square,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react'
import type {
  SimRegraIcms,
  ParametrizacaoFiscal,
  RegraNcmEmbalagem,
  DicionarioPrincipioAtivo,
} from '@/types/simulador'

const UFS_BRASIL = [
  'TODAS',
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]

export function Regras() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()
  const [abaAtiva, setAbaAtiva] = useState<string>('icms')

  // 1. ICMS Por UF (simulador_regras_icms)
  const [regrasIcms, setRegrasIcms] = useState<SimRegraIcms[]>([])
  const [totalIcms, setTotalIcms] = useState(0)
  const [pageIcms, setPageIcms] = useState(1)
  const [totalPagesIcms, setTotalPagesIcms] = useState(1)
  const [ufOrigemFiltro, setUfOrigemFiltro] = useState<string>('TODAS')
  const [ufDestinoFiltro, setUfDestinoFiltro] = useState<string>('TODAS')
  const [loadingIcms, setLoadingIcms] = useState(false)

  // Seleção na aba ICMS
  const [selecionados, setSelecionados] = useState<string[]>([])

  // Modal Edição Individual / Novo
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [registroEmEdicao, setRegistroEmEdicao] = useState<Partial<SimRegraIcms> | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // Modal Edição em Massa
  const [modalMassaAberto, setModalMassaAberto] = useState(false)
  const [camposMassa, setCamposMassa] = useState<{
    aliquota_icms: string
    reducao_base: string
    aliquota_efetiva: string
    diferimento: string // 'manter' | 'sim' | 'nao'
    percentual_diferimento: string
    tipo_operacao: string
    grupo_tributario_codigo: string
    fundamentacao_legal: string
  }>({
    aliquota_icms: '',
    reducao_base: '',
    aliquota_efetiva: '',
    diferimento: 'manter',
    percentual_diferimento: '',
    tipo_operacao: '',
    grupo_tributario_codigo: '',
    fundamentacao_legal: '',
  })
  const [salvandoMassa, setSalvandoMassa] = useState(false)

  // Modal Exclusão
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false)
  const [itemParaExcluir, setItemParaExcluir] = useState<{ id: string; titulo: string } | null>(
    null,
  )
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false)
  const [executandoExclusao, setExecutandoExclusao] = useState(false)

  // 2. Parametrização Fiscal
  const [parametrizacoes, setParametrizacoes] = useState<ParametrizacaoFiscal[]>([])
  const [totalParam, setTotalParam] = useState(0)
  const [pageParam, setPageParam] = useState(1)
  const [totalPagesParam, setTotalPagesParam] = useState(1)
  const [searchParam, setSearchParam] = useState('')
  const [loadingParam, setLoadingParam] = useState(false)

  // 3. Regras NCM / Embalagem
  const [regrasEmbalagem, setRegrasEmbalagem] = useState<RegraNcmEmbalagem[]>([])
  const [totalEmb, setTotalEmb] = useState(0)
  const [pageEmb, setPageEmb] = useState(1)
  const [totalPagesEmb, setTotalPagesEmb] = useState(1)
  const [searchEmb, setSearchEmb] = useState('')
  const [loadingEmb, setLoadingEmb] = useState(false)

  // 4. Princípios Ativos
  const [principiosAtivos, setPrincipiosAtivos] = useState<DicionarioPrincipioAtivo[]>([])
  const [totalPa, setTotalPa] = useState(0)
  const [pagePa, setPagePa] = useState(1)
  const [totalPagesPa, setTotalPagesPa] = useState(1)
  const [searchPa, setSearchPa] = useState('')
  const [loadingPa, setLoadingPa] = useState(false)

  // Carregar ICMS
  const carregarIcms = useCallback(
    async (targetPage = 1) => {
      setLoadingIcms(true)
      try {
        const filters: string[] = []
        if (ufOrigemFiltro !== 'TODAS') filters.push(`uf_origem = '${ufOrigemFiltro}'`)
        if (ufDestinoFiltro !== 'TODAS') filters.push(`uf_destino = '${ufDestinoFiltro}'`)
        const filterStr = filters.length > 0 ? filters.join(' && ') : undefined

        const res = await simuladorDataService.listarRegrasIcms(targetPage, 25, filterStr)
        setRegrasIcms(res.items)
        setTotalIcms(res.totalItems)
        setTotalPagesIcms(res.totalPages || 1)
        setPageIcms(targetPage)
      } catch (err) {
        console.error('Erro ao listar ICMS:', err)
        setRegrasIcms([])
      } finally {
        setLoadingIcms(false)
      }
    },
    [ufOrigemFiltro, ufDestinoFiltro],
  )

  // Gerenciamento de Seleção na aba ICMS
  const todosSelecionados =
    regrasIcms.length > 0 && regrasIcms.every((item) => selecionados.includes(item.id))

  const toggleSelecionarTudo = () => {
    if (todosSelecionados) {
      const idsPagina = new Set(regrasIcms.map((i) => i.id))
      setSelecionados((prev) => prev.filter((id) => !idsPagina.has(id)))
    } else {
      const novos = Array.from(new Set([...selecionados, ...regrasIcms.map((i) => i.id)]))
      setSelecionados(novos)
    }
  }

  const toggleSelecionarItem = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const limparSelecao = () => {
    setSelecionados([])
  }

  // Ações de Edição Individual
  const abrirModalNovo = () => {
    setRegistroEmEdicao({
      uf_origem: '',
      uf_destino: '',
      aliquota_icms: 0,
      reducao_base: 0,
      aliquota_efetiva: 0,
      diferimento: false,
      percentual_diferimento: 0,
      tipo_operacao: 'Interestadual',
      grupo_tributario_codigo: '',
      id_regra: '',
      fundamentacao_legal: '',
    })
    setModalEdicaoAberto(true)
  }

  const abrirModalEdicao = (r: SimRegraIcms) => {
    setRegistroEmEdicao({ ...r })
    setModalEdicaoAberto(true)
  }

  const salvarEdicaoIndividual = async () => {
    if (!registroEmEdicao) return
    if (!registroEmEdicao.uf_origem?.trim() || !registroEmEdicao.uf_destino?.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'UF Origem e UF Destino são obrigatórias.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoEdicao(true)
    try {
      if (registroEmEdicao.id) {
        await simuladorImportadorService.atualizarRegraIcms(registroEmEdicao.id, registroEmEdicao)
        toast({ title: 'Regra de ICMS atualizada com sucesso!' })
      } else {
        await simuladorImportadorService.criarRegraIcms(registroEmEdicao)
        toast({ title: 'Nova regra de ICMS cadastrada com sucesso!' })
      }
      setModalEdicaoAberto(false)
      setRegistroEmEdicao(null)
      await carregarIcms(pageIcms)
    } catch (err: any) {
      console.error('Erro ao salvar regra ICMS:', err)
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível gravar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  // Ações de Edição em Massa
  const abrirModalMassa = () => {
    setCamposMassa({
      aliquota_icms: '',
      reducao_base: '',
      aliquota_efetiva: '',
      diferimento: 'manter',
      percentual_diferimento: '',
      tipo_operacao: '',
      grupo_tributario_codigo: '',
      fundamentacao_legal: '',
    })
    setModalMassaAberto(true)
  }

  const salvarEdicaoMassa = async () => {
    if (selecionados.length === 0) return

    const payload: Partial<SimRegraIcms> = {}
    if (camposMassa.aliquota_icms.trim()) {
      const aliq = parseFloat(camposMassa.aliquota_icms.replace(',', '.'))
      if (!isNaN(aliq)) payload.aliquota_icms = aliq
    }
    if (camposMassa.reducao_base.trim()) {
      const red = parseFloat(camposMassa.reducao_base.replace(',', '.'))
      if (!isNaN(red)) payload.reducao_base = red
    }
    if (camposMassa.aliquota_efetiva.trim()) {
      const ef = parseFloat(camposMassa.aliquota_efetiva.replace(',', '.'))
      if (!isNaN(ef)) payload.aliquota_efetiva = ef
    }
    if (camposMassa.diferimento === 'sim') {
      payload.diferimento = true
    } else if (camposMassa.diferimento === 'nao') {
      payload.diferimento = false
    }
    if (camposMassa.percentual_diferimento.trim()) {
      const dif = parseFloat(camposMassa.percentual_diferimento.replace(',', '.'))
      if (!isNaN(dif)) payload.percentual_diferimento = dif
    }
    if (camposMassa.tipo_operacao.trim()) {
      payload.tipo_operacao = camposMassa.tipo_operacao.trim()
    }
    if (camposMassa.grupo_tributario_codigo.trim()) {
      payload.grupo_tributario_codigo = camposMassa.grupo_tributario_codigo.trim()
    }
    if (camposMassa.fundamentacao_legal.trim()) {
      payload.fundamentacao_legal = camposMassa.fundamentacao_legal.trim()
    }

    if (Object.keys(payload).length === 0) {
      toast({
        title: 'Nenhum campo preenchido',
        description: 'Informe ao menos um campo para atualizar as regras selecionadas.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoMassa(true)
    try {
      const res = await simuladorImportadorService.atualizarRegrasIcmsEmMassa(selecionados, payload)
      toast({
        title: 'Atualização em massa concluída',
        description: `${res.sucesso} de ${selecionados.length} regras de ICMS atualizadas com sucesso.${
          res.falhas > 0 ? ` (${res.falhas} falhas)` : ''
        }`,
      })
      setModalMassaAberto(false)
      await carregarIcms(pageIcms)
    } catch (err: any) {
      console.error('Erro na atualização em massa:', err)
      toast({
        title: 'Erro na atualização em massa',
        description: err.message || 'Falha ao aplicar alterações nas regras selecionadas.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoMassa(false)
    }
  }

  // Ações de Exclusão
  const confirmarExclusaoItem = (id: string, titulo: string) => {
    setItemParaExcluir({ id, titulo })
    setExcluindoEmMassa(false)
    setModalExclusaoAberto(true)
  }

  const confirmarExclusaoMassa = () => {
    if (selecionados.length === 0) return
    setItemParaExcluir(null)
    setExcluindoEmMassa(true)
    setModalExclusaoAberto(true)
  }

  const executarExclusao = async () => {
    if (!isAdmin) {
      toast({
        title: 'Acesso Restrito',
        description: 'Apenas Administradores podem excluir registros.',
        variant: 'destructive',
      })
      return
    }

    setExecutandoExclusao(true)
    try {
      if (excluindoEmMassa) {
        const res = await simuladorImportadorService.excluirRegrasIcmsEmMassa(selecionados)
        toast({
          title: 'Exclusão em massa concluída',
          description: `${res.sucesso} regras de ICMS foram removidas.${
            res.falhas > 0 ? ` (${res.falhas} falhas)` : ''
          }`,
        })
        setSelecionados([])
        await carregarIcms(pageIcms)
      } else if (itemParaExcluir) {
        await simuladorImportadorService.excluirRegraIcms(itemParaExcluir.id)
        toast({ title: 'Regra de ICMS excluída com sucesso.' })
        setSelecionados((prev) => prev.filter((id) => id !== itemParaExcluir.id))
        await carregarIcms(pageIcms)
      }
      setModalExclusaoAberto(false)
      setItemParaExcluir(null)
      setExcluindoEmMassa(false)
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Falha ao remover regra(s) de ICMS.',
        variant: 'destructive',
      })
    } finally {
      setExecutandoExclusao(false)
    }
  }

  // Carregar Parametrização Fiscal
  const carregarParametrizacao = useCallback(
    async (targetPage = 1) => {
      setLoadingParam(true)
      try {
        const termo = searchParam.trim().replace(/'/g, "\\'")
        const filterStr = termo ? `ncm ~ '${termo}' || classificacao ~ '${termo}'` : undefined
        const res = await simuladorDataService.listarParametrizacaoFiscal(targetPage, 25, filterStr)
        setParametrizacoes(res.items)
        setTotalParam(res.totalItems)
        setTotalPagesParam(res.totalPages || 1)
        setPageParam(targetPage)
      } catch (err) {
        console.error('Erro ao listar Parametrização Fiscal:', err)
        setParametrizacoes([])
      } finally {
        setLoadingParam(false)
      }
    },
    [searchParam],
  )

  // Carregar Embalagens
  const carregarEmbalagens = useCallback(
    async (targetPage = 1) => {
      setLoadingEmb(true)
      try {
        const termo = searchEmb.trim().replace(/'/g, "\\'")
        const filterStr = termo ? `ncm ~ '${termo}' || descricao ~ '${termo}'` : undefined
        const res = await simuladorDataService.listarRegrasNcmEmbalagem(targetPage, 25, filterStr)
        setRegrasEmbalagem(res.items)
        setTotalEmb(res.totalItems)
        setTotalPagesEmb(res.totalPages || 1)
        setPageEmb(targetPage)
      } catch (err) {
        console.error('Erro ao listar Regras Embalagem:', err)
        setRegrasEmbalagem([])
      } finally {
        setLoadingEmb(false)
      }
    },
    [searchEmb],
  )

  // Carregar Princípios Ativos
  const carregarPrincipiosAtivos = useCallback(
    async (targetPage = 1) => {
      setLoadingPa(true)
      try {
        const termo = searchPa.trim().replace(/'/g, "\\'")
        const filterStr = termo
          ? `principio_ativo ~ '${termo}' || classe ~ '${termo}' || grupo_quimico ~ '${termo}' || ncm_padrao_referencia ~ '${termo}'`
          : undefined
        const res = await simuladorDataService.listarPrincipiosAtivos(targetPage, 25, filterStr)
        setPrincipiosAtivos(res.items)
        setTotalPa(res.totalItems)
        setTotalPagesPa(res.totalPages || 1)
        setPagePa(targetPage)
      } catch (err) {
        console.error('Erro ao listar Princípios Ativos:', err)
        setPrincipiosAtivos([])
      } finally {
        setLoadingPa(false)
      }
    },
    [searchPa],
  )

  useEffect(() => {
    if (abaAtiva === 'icms') carregarIcms(1)
    else if (abaAtiva === 'param') carregarParametrizacao(1)
    else if (abaAtiva === 'embalagem') carregarEmbalagens(1)
    else if (abaAtiva === 'principios') carregarPrincipiosAtivos(1)
  }, [abaAtiva, carregarIcms, carregarParametrizacao, carregarEmbalagens, carregarPrincipiosAtivos])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <FileStack className="w-6 h-6 text-[#1D6A43]" />
            Regras Fiscais & Parâmetros Tributários
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Consulta consolidada de matrizes interestaduais de ICMS, PIS/COFINS, IBS/CBS e regras de
            embalagem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {abaAtiva === 'icms' && (
            <Button
              onClick={abrirModalNovo}
              size="sm"
              className="h-8 gap-1.5 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
            >
              <Plus className="w-4 h-4" />
              Nova Regra ICMS
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (abaAtiva === 'icms') carregarIcms(pageIcms)
              else if (abaAtiva === 'param') carregarParametrizacao(pageParam)
              else if (abaAtiva === 'embalagem') carregarEmbalagens(pageEmb)
              else carregarPrincipiosAtivos(pagePa)
            }}
            className="h-8 gap-1.5 text-xs border-[#E4EAE5] text-[#1E2A24]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#1D6A43]" />
            Recarregar Matriz
          </Button>
        </div>
      </div>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
        <TabsList className="grid w-full sm:w-[650px] grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="icms" className="gap-1.5 text-xs">
            <Scale className="w-3.5 h-3.5" />
            ICMS Por UF
          </TabsTrigger>
          <TabsTrigger value="param" className="gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Parametrização
          </TabsTrigger>
          <TabsTrigger value="embalagem" className="gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5" />
            Regras NCM
          </TabsTrigger>
          <TabsTrigger value="principios" className="gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" />
            Princípios Ativos
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------------- */}
        {/* ABA 1: ICMS POR UF */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="icms" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1E2A24]">Origem:</span>
                <Select value={ufOrigemFiltro} onValueChange={setUfOrigemFiltro}>
                  <SelectTrigger className="h-8 w-28 text-xs border-[#E4EAE5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS_BRASIL.map((uf) => (
                      <SelectItem key={`orig_${uf}`} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#1E2A24]">Destino:</span>
                <Select value={ufDestinoFiltro} onValueChange={setUfDestinoFiltro}>
                  <SelectTrigger className="h-8 w-28 text-xs border-[#E4EAE5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS_BRASIL.map((uf) => (
                      <SelectItem key={`dest_${uf}`} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                onClick={() => carregarIcms(1)}
                className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
              >
                Filtrar
              </Button>
            </div>

            {/* Barra de Ações em Lote quando há seleção */}
            {selecionados.length > 0 && (
              <div className="pt-2 border-t border-[#E4EAE5] flex flex-wrap items-center justify-between gap-2 bg-[#F7F9F6] p-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-[#1D6A43] border-emerald-300 text-xs font-semibold"
                  >
                    {selecionados.length} regra(s) selecionada(s)
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={limparSelecao}
                    className="h-7 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Limpar seleção
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={abrirModalMassa}
                    className="h-8 text-xs gap-1.5 border-[#1D6A43] text-[#1D6A43] hover:bg-[#E6F2EC]"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Alterar Selecionadas ({selecionados.length})
                  </Button>

                  {isAdmin ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={confirmarExclusaoMassa}
                      className="h-8 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Selecionadas ({selecionados.length})
                    </Button>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">
                      (Exclusão requer perfil Admin)
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelecionarTudo}
                        className="text-slate-500 hover:text-[#1D6A43] transition-colors"
                        title={todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
                      >
                        {todosSelecionados ? (
                          <CheckSquare className="w-4 h-4 text-[#1D6A43]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">Origem → Destino</th>
                    <th className="py-3 px-3">Alíquota ICMS</th>
                    <th className="py-3 px-3">Redução Base</th>
                    <th className="py-3 px-3">Alíquota Efetiva</th>
                    <th className="py-3 px-3">Diferimento</th>
                    <th className="py-3 px-3">Tipo Operação</th>
                    <th className="py-3 px-3">Grupo Tributário</th>
                    <th className="py-3 px-3 min-w-[180px]">Fundamentação Legal</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingIcms ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando regras de ICMS...
                      </td>
                    </tr>
                  ) : regrasIcms.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        Nenhuma regra de ICMS encontrada com estes filtros.
                      </td>
                    </tr>
                  ) : (
                    regrasIcms.map((r) => {
                      const isSelected = selecionados.includes(r.id)
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-[#F7F9F6] transition-colors ${
                            isSelected ? 'bg-emerald-50/50' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelecionarItem(r.id)}
                              className="text-slate-400 hover:text-[#1D6A43]"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#1D6A43]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#1E2A24]">
                            {r.uf_origem} → {r.uf_destino}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#1E2A24]">
                            {r.aliquota_icms}%
                          </td>
                          <td className="py-2.5 px-3 text-[#5D6B63]">
                            {r.reducao_base ? `${r.reducao_base}%` : '0%'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#1D6A43]">
                            {r.aliquota_efetiva !== undefined
                              ? `${r.aliquota_efetiva}%`
                              : `${(r.aliquota_icms * (1 - (r.reducao_base || 0) / 100)).toFixed(2)}%`}
                          </td>
                          <td className="py-2.5 px-3">
                            {r.diferimento ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300"
                              >
                                SIM{' '}
                                {r.percentual_diferimento ? `(${r.percentual_diferimento}%)` : ''}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">Não</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[#5D6B63]">
                            {r.tipo_operacao || 'Venda'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {r.grupo_tributario_codigo || 'Geral'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#5D6B63] italic truncate max-w-xs">
                            {r.fundamentacao_legal || 'Convênio ICMS 100/97 e alterações'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => abrirModalEdicao(r)}
                                className="h-7 w-7 text-slate-500 hover:text-[#1D6A43] hover:bg-emerald-50"
                                title="Editar regra"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    confirmarExclusaoItem(
                                      r.id,
                                      `Regra ICMS ${r.uf_origem} → ${r.uf_destino} (${r.id_regra || 'Padrão'})`,
                                    )
                                  }
                                  className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="Excluir regra"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-[#E4EAE5] bg-[#FAFBF9] text-xs text-[#5D6B63]">
              <div>
                Mostrando {regrasIcms.length} de {totalIcms} regras
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarIcms(Math.max(1, pageIcms - 1))}
                  disabled={pageIcms <= 1 || loadingIcms}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="font-semibold px-2 text-[#1E2A24]">
                  {pageIcms} / {totalPagesIcms}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarIcms(Math.min(totalPagesIcms, pageIcms + 1))}
                  disabled={pageIcms >= totalPagesIcms || loadingIcms}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* ABA 2: PARAMETRIZAÇÃO FISCAL */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="param" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchParam}
                onChange={(e) => setSearchParam(e.target.value)}
                placeholder="Filtrar por NCM ou Classificação..."
                className="pl-9 text-xs h-9 border-[#E4EAE5]"
              />
            </div>
          </Card>

          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">NCM</th>
                    <th className="py-3 px-3">PIS (%)</th>
                    <th className="py-3 px-3">COFINS (%)</th>
                    <th className="py-3 px-3">Regime</th>
                    <th className="py-3 px-3">IBS (%) 2027</th>
                    <th className="py-3 px-3">CBS (%) 2027</th>
                    <th className="py-3 px-3">Classificação</th>
                    <th className="py-3 px-3">Tributação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingParam ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando parametrização fiscal...
                      </td>
                    </tr>
                  ) : parametrizacoes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        Nenhum registro de parametrização encontrado.
                      </td>
                    </tr>
                  ) : (
                    parametrizacoes.map((p) => (
                      <tr key={p.id} className="hover:bg-[#F7F9F6] transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1D6A43]">{p.ncm}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#1E2A24]">
                          {p.aliquota_pis}%
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#1E2A24]">
                          {p.aliquota_cofins}%
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-sky-50 text-sky-800 border-sky-300"
                          >
                            {p.regime}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-[#2FA36B] font-semibold">
                          {p.aliquota_ibs}%
                        </td>
                        <td className="py-2.5 px-3 text-[#D9534F] font-semibold">
                          {p.aliquota_cbs}%
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{p.classificacao}</td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{p.tributacao}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-[#E4EAE5] bg-[#FAFBF9] text-xs text-[#5D6B63]">
              <div>
                Mostrando {parametrizacoes.length} de {totalParam} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarParametrizacao(Math.max(1, pageParam - 1))}
                  disabled={pageParam <= 1 || loadingParam}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="font-semibold px-2 text-[#1E2A24]">
                  {pageParam} / {totalPagesParam}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarParametrizacao(Math.min(totalPagesParam, pageParam + 1))}
                  disabled={pageParam >= totalPagesParam || loadingParam}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* ABA 3: REGRAS NCM / EMBALAGEM */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="embalagem" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchEmb}
                onChange={(e) => setSearchEmb(e.target.value)}
                placeholder="Filtrar regras de embalagem por NCM..."
                className="pl-9 text-xs h-9 border-[#E4EAE5]"
              />
            </div>
          </Card>

          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">NCM</th>
                    <th className="py-3 px-3 min-w-[200px]">Descrição NCM</th>
                    <th className="py-3 px-3">Embalagens Permitidas</th>
                    <th className="py-3 px-3">Regra Especial TIPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingEmb ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando regras de NCM e Embalagem...
                      </td>
                    </tr>
                  ) : regrasEmbalagem.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        Nenhuma regra cadastrada.
                      </td>
                    </tr>
                  ) : (
                    regrasEmbalagem.map((e) => (
                      <tr key={e.id} className="hover:bg-[#F7F9F6] transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1D6A43]">{e.ncm}</td>
                        <td className="py-2.5 px-3 text-[#1E2A24] font-medium">{e.descricao}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(e.embalagens_permitidas) &&
                            e.embalagens_permitidas.length > 0 ? (
                              e.embalagens_permitidas.map((emb, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-[10px] bg-slate-50 border-slate-200"
                                >
                                  {emb}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-400">Qualquer embalagem</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63] italic">
                          {e.regra_especial || 'Padrão Agro'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-[#E4EAE5] bg-[#FAFBF9] text-xs text-[#5D6B63]">
              <div>
                Mostrando {regrasEmbalagem.length} de {totalEmb} regras
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarEmbalagens(Math.max(1, pageEmb - 1))}
                  disabled={pageEmb <= 1 || loadingEmb}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="font-semibold px-2 text-[#1E2A24]">
                  {pageEmb} / {totalPagesEmb}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarEmbalagens(Math.min(totalPagesEmb, pageEmb + 1))}
                  disabled={pageEmb >= totalPagesEmb || loadingEmb}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* ABA 4: PRINCÍPIOS ATIVOS */}
        {/* ---------------------------------------------------------------- */}
        <TabsContent value="principios" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchPa}
                onChange={(e) => setSearchPa(e.target.value)}
                placeholder="Filtrar por Princípio Ativo, Classe ou Grupo Químico..."
                className="pl-9 text-xs h-9 border-[#E4EAE5]"
              />
            </div>
          </Card>

          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Princípio Ativo</th>
                    <th className="py-3 px-3">Classe</th>
                    <th className="py-3 px-3">Grupo Químico</th>
                    <th className="py-3 px-3">Faixa Concentração</th>
                    <th className="py-3 px-3">NCM Padrão</th>
                    <th className="py-3 px-3">Nota Subposição 2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingPa ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando dicionário de princípios ativos...
                      </td>
                    </tr>
                  ) : principiosAtivos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        Nenhum princípio ativo encontrado.
                      </td>
                    </tr>
                  ) : (
                    principiosAtivos.map((pa) => (
                      <tr key={pa.id} className="hover:bg-[#F7F9F6] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-[#1E2A24]">
                          {pa.principio_ativo}
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{pa.classe || '—'}</td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{pa.grupo_quimico || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {pa.concentracao_min || 0} - {pa.concentracao_max || 0}{' '}
                          {pa.unidade || '%'}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1D6A43]">
                          {pa.ncm_padrao_referencia || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              pa.nota_subpos_2 === 'SIM'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {pa.nota_subpos_2 || 'NÃO'}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-[#E4EAE5] bg-[#FAFBF9] text-xs text-[#5D6B63]">
              <div>
                Mostrando {principiosAtivos.length} de {totalPa} princípios ativos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarPrincipiosAtivos(Math.max(1, pagePa - 1))}
                  disabled={pagePa <= 1 || loadingPa}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="font-semibold px-2 text-[#1E2A24]">
                  {pagePa} / {totalPagesPa}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarPrincipiosAtivos(Math.min(totalPagesPa, pagePa + 1))}
                  disabled={pagePa >= totalPagesPa || loadingPa}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE EDIÇÃO INDIVIDUAL OU NOVA REGRA DE ICMS */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1E2A24] flex items-center gap-2">
              <Edit className="w-4 h-4 text-[#1D6A43]" />
              {registroEmEdicao?.id ? 'Alterar Regra Fiscal ICMS' : 'Nova Regra Fiscal ICMS'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os parâmetros de alíquotas e benefícios da operação fiscal interestadual.
            </DialogDescription>
          </DialogHeader>

          {registroEmEdicao && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">UF Origem *:</label>
                  <Input
                    value={registroEmEdicao.uf_origem || ''}
                    maxLength={2}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        uf_origem: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="SP"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">UF Destino *:</label>
                  <Input
                    value={registroEmEdicao.uf_destino || ''}
                    maxLength={2}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        uf_destino: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="MT"
                    className="h-8 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Alíquota ICMS (%):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={registroEmEdicao.aliquota_icms ?? 0}
                    onChange={(e) => {
                      const aliq = parseFloat(e.target.value) || 0
                      const red = registroEmEdicao.reducao_base || 0
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        aliquota_icms: aliq,
                        aliquota_efetiva: Number((aliq * (1 - red / 100)).toFixed(2)),
                      })
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Redução de Base (%):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={registroEmEdicao.reducao_base ?? 0}
                    onChange={(e) => {
                      const red = parseFloat(e.target.value) || 0
                      const aliq = registroEmEdicao.aliquota_icms || 0
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        reducao_base: red,
                        aliquota_efetiva: Number((aliq * (1 - red / 100)).toFixed(2)),
                      })
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Alíquota Efetiva (%):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={registroEmEdicao.aliquota_efetiva ?? 0}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        aliquota_efetiva: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Diferimento:</label>
                  <Select
                    value={registroEmEdicao.diferimento ? 'sim' : 'nao'}
                    onValueChange={(val) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        diferimento: val === 'sim',
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao">Não</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">% Diferimento:</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={registroEmEdicao.percentual_diferimento ?? 0}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        percentual_diferimento: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Tipo Operação:</label>
                  <Input
                    value={registroEmEdicao.tipo_operacao || 'Interestadual'}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        tipo_operacao: e.target.value,
                      })
                    }
                    placeholder="Interestadual"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Código GrTrib:</label>
                  <Input
                    value={registroEmEdicao.grupo_tributario_codigo || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        grupo_tributario_codigo: e.target.value,
                      })
                    }
                    placeholder="001, 002..."
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">ID da Regra:</label>
                  <Input
                    value={registroEmEdicao.id_regra || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, id_regra: e.target.value })
                    }
                    placeholder="BAACInterestadual001"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Fundamentação Legal:</label>
                <Input
                  value={registroEmEdicao.fundamentacao_legal || ''}
                  onChange={(e) =>
                    setRegistroEmEdicao({
                      ...registroEmEdicao,
                      fundamentacao_legal: e.target.value,
                    })
                  }
                  placeholder="ex: Convênio ICMS 100/97"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalEdicaoAberto(false)}
              className="h-8 text-xs border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvarEdicaoIndividual}
              disabled={salvandoEdicao}
              className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
            >
              {salvandoEdicao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE EDIÇÃO EM MASSA DE REGRAS ICMS */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={modalMassaAberto} onOpenChange={setModalMassaAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1E2A24] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#1D6A43]" />
              Alterar {selecionados.length} Regras Fiscais em Massa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha apenas os campos tributários que você deseja aplicar a todas as regras
              selecionadas. Campos deixados em branco serão mantidos inalterados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Alíquota ICMS (%):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={camposMassa.aliquota_icms}
                  onChange={(e) =>
                    setCamposMassa({ ...camposMassa, aliquota_icms: e.target.value })
                  }
                  placeholder="ex: 12"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Redução Base (%):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={camposMassa.reducao_base}
                  onChange={(e) => setCamposMassa({ ...camposMassa, reducao_base: e.target.value })}
                  placeholder="ex: 60"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Alíquota Efetiva (%):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={camposMassa.aliquota_efetiva}
                  onChange={(e) =>
                    setCamposMassa({ ...camposMassa, aliquota_efetiva: e.target.value })
                  }
                  placeholder="ex: 4.80"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Diferimento:</label>
                <Select
                  value={camposMassa.diferimento}
                  onValueChange={(val) => setCamposMassa({ ...camposMassa, diferimento: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manter">(Não alterar)</SelectItem>
                    <SelectItem value="sim">Sim (Ativar diferimento)</SelectItem>
                    <SelectItem value="nao">Não (Desativar diferimento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">% Diferimento:</label>
                <Input
                  type="number"
                  step="0.01"
                  value={camposMassa.percentual_diferimento}
                  onChange={(e) =>
                    setCamposMassa({ ...camposMassa, percentual_diferimento: e.target.value })
                  }
                  placeholder="ex: 100"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Tipo de Operação:</label>
                <Input
                  value={camposMassa.tipo_operacao}
                  onChange={(e) =>
                    setCamposMassa({ ...camposMassa, tipo_operacao: e.target.value })
                  }
                  placeholder="ex: Interestadual, Interna..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Grupo Tributário (GrTrib):</label>
                <Input
                  value={camposMassa.grupo_tributario_codigo}
                  onChange={(e) =>
                    setCamposMassa({ ...camposMassa, grupo_tributario_codigo: e.target.value })
                  }
                  placeholder="ex: 001, 002..."
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Fundamentação Legal:</label>
              <Input
                value={camposMassa.fundamentacao_legal}
                onChange={(e) =>
                  setCamposMassa({ ...camposMassa, fundamentacao_legal: e.target.value })
                }
                placeholder="ex: Convênio ICMS 100/97"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalMassaAberto(false)}
              className="h-8 text-xs border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={salvarEdicaoMassa}
              disabled={salvandoMassa}
              className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
            >
              {salvandoMassa ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Aplicar a {selecionados.length} Regras
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={modalExclusaoAberto} onOpenChange={setModalExclusaoAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 pt-2">
              {excluindoEmMassa ? (
                <>
                  Você tem certeza que deseja excluir permanentemente as{' '}
                  <strong className="text-red-700">
                    {selecionados.length} regras de ICMS selecionadas
                  </strong>{' '}
                  da base <code className="font-mono text-xs">simulador_regras_icms</code>? Esta
                  ação não pode ser desfeita.
                </>
              ) : (
                <>
                  Você tem certeza que deseja excluir a regra de ICMS{' '}
                  <strong className="text-red-700">{itemParaExcluir?.titulo}</strong>?
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalExclusaoAberto(false)}
              className="h-8 text-xs"
              disabled={executandoExclusao}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={executarExclusao}
              disabled={executandoExclusao}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {executandoExclusao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirmar e Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Regras
