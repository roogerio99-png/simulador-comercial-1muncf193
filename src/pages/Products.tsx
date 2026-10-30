import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Package,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Loader2,
  X,
  Calculator,
} from 'lucide-react'
import { simuladorDataService } from '@/services/simuladorDataService'
import { simuladorImportadorService } from '@/services/simuladorImportadorService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { ModalLimparBase } from '@/components/ModalLimparBase'
import {
  CheckSquare,
  Square,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react'
import type { SimProdutoBase, BaseMestreProduto } from '@/types/simulador'

export function Products() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ncmParam = searchParams.get('ncm') || ''
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  // Aba selecionada
  const [abaAtiva, setAbaAtiva] = useState<'produtos' | 'mestre'>('produtos')

  // Estado Aba 1: Base de Produtos (simulador_produtos)
  const [produtos, setProdutos] = useState<SimProdutoBase[]>([])
  const [totalProdutos, setTotalProdutos] = useState(0)
  const [totalPagesProd, setTotalPagesProd] = useState(1)
  const [pageProd, setPageProd] = useState(1)
  const [perPageProd, setPerPageProd] = useState(20)
  const [searchProd, setSearchProd] = useState(ncmParam)
  const [origemFiltro, setOrigemFiltro] = useState<string>('todos')
  const [loadingProd, setLoadingProd] = useState(false)

  // Seleção de produtos
  const [selecionados, setSelecionados] = useState<string[]>([])

  // Modal de Edição Individual / Novo Registro
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [registroEmEdicao, setRegistroEmEdicao] = useState<Partial<SimProdutoBase> | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // Modal de Edição em Massa
  const [modalMassaAberto, setModalMassaAberto] = useState(false)
  const [camposMassa, setCamposMassa] = useState<{
    origem: string
    unidade: string
    embalagem: string
    gr_trib: string
    segmento: string
    fabricante: string
    moeda: string
    preco_base_sugerido: string
  }>({
    origem: '',
    unidade: '',
    embalagem: '',
    gr_trib: '',
    segmento: '',
    fabricante: '',
    moeda: '',
    preco_base_sugerido: '',
  })
  const [salvandoMassa, setSalvandoMassa] = useState(false)

  // Modal de Confirmação de Exclusão
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false)
  const [itemParaExcluir, setItemParaExcluir] = useState<{ id: string; titulo: string } | null>(
    null,
  )
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false)
  const [executandoExclusao, setExecutandoExclusao] = useState(false)

  // Modal de Limpeza Total da Base
  const [modalLimparBaseAberto, setModalLimparBaseAberto] = useState(false)

  // Drawer de Detalhes do Produto
  const [produtoSelecionadoDrawer, setProdutoSelecionadoDrawer] = useState<SimProdutoBase | null>(
    null,
  )

  // Estado Aba 2: Base Mestre (simulador_base_mestre)
  const [mestreItens, setMestreItens] = useState<BaseMestreProduto[]>([])
  const [totalMestre, setTotalMestre] = useState(0)
  const [totalPagesMestre, setTotalPagesMestre] = useState(1)
  const [pageMestre, setPageMestre] = useState(1)
  const [perPageMestre, setPerPageMestre] = useState(20)
  const [searchMestre, setSearchMestre] = useState('')
  const [statusMestre, setStatusMestre] = useState<string>('todos')
  const [loadingMestre, setLoadingMestre] = useState(false)
  const [mestreSelecionadoDrawer, setMestreSelecionadoDrawer] = useState<BaseMestreProduto | null>(
    null,
  )

  // Carregar Base de Produtos
  const carregarProdutos = useCallback(
    async (targetPage = 1) => {
      setLoadingProd(true)
      try {
        const termo = searchProd.trim().replace(/'/g, "\\'")
        const filters: string[] = []
        if (termo) {
          filters.push(
            `(descricao ~ '${termo}' || codigo ~ '${termo}' || ncm ~ '${termo}' || principio_ativo ~ '${termo}' || fabricante ~ '${termo}')`,
          )
        }
        if (origemFiltro !== 'todos') {
          filters.push(`origem = '${origemFiltro}'`)
        }
        const filterStr = filters.length > 0 ? filters.join(' && ') : undefined

        const res = await simuladorDataService.listarProdutos(targetPage, perPageProd, filterStr)
        setProdutos(res.items)
        setTotalProdutos(res.totalItems)
        setTotalPagesProd(res.totalPages || 1)
        setPageProd(targetPage)
      } catch (err) {
        console.error('Erro ao listar produtos:', err)
        setProdutos([])
        setTotalProdutos(0)
      } finally {
        setLoadingProd(false)
      }
    },
    [searchProd, origemFiltro, perPageProd],
  )

  // Carregar Base Mestre
  const carregarBaseMestre = useCallback(
    async (targetPage = 1) => {
      setLoadingMestre(true)
      try {
        const termo = searchMestre.trim().replace(/'/g, "\\'")
        const filters: string[] = []
        if (termo) {
          filters.push(
            `(nome_produto ~ '${termo}' || marca_padronizada ~ '${termo}' || registro_mapa ~ '${termo}' || ncm ~ '${termo}' || principio_ativo ~ '${termo}')`,
          )
        }
        if (statusMestre !== 'todos') {
          filters.push(`status_validacao = '${statusMestre}'`)
        }
        const filterStr = filters.length > 0 ? filters.join(' && ') : undefined

        const res = await simuladorDataService.listarBaseMestre(
          targetPage,
          perPageMestre,
          filterStr,
        )
        setMestreItens(res.items)
        setTotalMestre(res.totalItems)
        setTotalPagesMestre(res.totalPages || 1)
        setPageMestre(targetPage)
      } catch (err) {
        console.error('Erro ao listar base mestre:', err)
        setMestreItens([])
        setTotalMestre(0)
      } finally {
        setLoadingMestre(false)
      }
    },
    [searchMestre, statusMestre, perPageMestre],
  )

  // Gerenciamento de Seleção
  const todosSelecionados =
    produtos.length > 0 && produtos.every((item) => selecionados.includes(item.id))

  const toggleSelecionarTudo = () => {
    if (todosSelecionados) {
      const idsPagina = new Set(produtos.map((i) => i.id))
      setSelecionados((prev) => prev.filter((id) => !idsPagina.has(id)))
    } else {
      const novos = Array.from(new Set([...selecionados, ...produtos.map((i) => i.id)]))
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

  // Ações de Edição
  const abrirModalNovo = () => {
    setRegistroEmEdicao({
      codigo: '',
      descricao: '',
      ncm: '',
      unidade: 'UN',
      origem: 'Nacional',
      embalagem: '',
      principio_ativo: '',
      fabricante: '',
      moeda: 'BRL',
      preco_base_sugerido: 0,
      gr_trib: '',
      segmento: '',
    })
    setModalEdicaoAberto(true)
  }

  const abrirModalEdicao = (p: SimProdutoBase) => {
    setRegistroEmEdicao({ ...p })
    setModalEdicaoAberto(true)
  }

  const salvarEdicaoIndividual = async () => {
    if (!registroEmEdicao) return
    if (!registroEmEdicao.descricao?.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'A Descrição do produto é obrigatória.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoEdicao(true)
    try {
      if (registroEmEdicao.id) {
        await simuladorImportadorService.atualizarProduto(registroEmEdicao.id, registroEmEdicao)
        toast({ title: 'Produto atualizado com sucesso!' })
      } else {
        await simuladorImportadorService.criarProduto(registroEmEdicao)
        toast({ title: 'Novo produto cadastrado com sucesso!' })
      }
      setModalEdicaoAberto(false)
      setRegistroEmEdicao(null)
      await carregarProdutos(pageProd)
    } catch (err: any) {
      console.error('Erro ao salvar produto:', err)
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
      origem: '',
      unidade: '',
      embalagem: '',
      gr_trib: '',
      segmento: '',
      fabricante: '',
      moeda: '',
      preco_base_sugerido: '',
    })
    setModalMassaAberto(true)
  }

  const salvarEdicaoMassa = async () => {
    if (selecionados.length === 0) return

    const payload: Partial<SimProdutoBase> = {}
    if (camposMassa.origem) payload.origem = camposMassa.origem
    if (camposMassa.unidade.trim()) payload.unidade = camposMassa.unidade.trim()
    if (camposMassa.embalagem.trim()) payload.embalagem = camposMassa.embalagem.trim()
    if (camposMassa.gr_trib.trim()) payload.gr_trib = camposMassa.gr_trib.trim()
    if (camposMassa.segmento.trim()) payload.segmento = camposMassa.segmento.trim()
    if (camposMassa.fabricante.trim()) payload.fabricante = camposMassa.fabricante.trim()
    if (camposMassa.moeda.trim()) payload.moeda = camposMassa.moeda.trim().toUpperCase()
    if (camposMassa.preco_base_sugerido.trim()) {
      const preco = parseFloat(camposMassa.preco_base_sugerido.replace(',', '.'))
      if (!isNaN(preco)) payload.preco_base_sugerido = preco
    }

    if (Object.keys(payload).length === 0) {
      toast({
        title: 'Nenhum campo preenchido',
        description: 'Informe ao menos um campo para atualizar os registros selecionados.',
        variant: 'destructive',
      })
      return
    }

    setSalvandoMassa(true)
    try {
      const res = await simuladorImportadorService.atualizarProdutosEmMassa(selecionados, payload)
      toast({
        title: 'Atualização em massa concluída',
        description: `${res.sucesso} de ${selecionados.length} produtos atualizados com sucesso.${
          res.falhas > 0 ? ` (${res.falhas} falhas)` : ''
        }`,
      })
      setModalMassaAberto(false)
      await carregarProdutos(pageProd)
    } catch (err: any) {
      console.error('Erro na atualização em massa:', err)
      toast({
        title: 'Erro na atualização em massa',
        description: err.message || 'Falha ao aplicar alterações nos registros selecionados.',
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
        const res = await simuladorImportadorService.excluirProdutosEmMassa(selecionados)
        toast({
          title: 'Exclusão em massa concluída',
          description: `${res.sucesso} produtos foram removidos.${
            res.falhas > 0 ? ` (${res.falhas} falhas)` : ''
          }`,
        })
        setSelecionados([])
        await carregarProdutos(pageProd)
      } else if (itemParaExcluir) {
        await simuladorImportadorService.excluirProduto(itemParaExcluir.id)
        toast({ title: 'Produto excluído com sucesso.' })
        setSelecionados((prev) => prev.filter((id) => id !== itemParaExcluir.id))
        await carregarProdutos(pageProd)
      }
      setModalExclusaoAberto(false)
      setItemParaExcluir(null)
      setExcluindoEmMassa(false)
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Falha ao remover produto(s).',
        variant: 'destructive',
      })
    } finally {
      setExecutandoExclusao(false)
    }
  }

  useEffect(() => {
    carregarProdutos(1)
  }, [carregarProdutos])

  useEffect(() => {
    if (abaAtiva === 'mestre') {
      carregarBaseMestre(1)
    }
  }, [abaAtiva, carregarBaseMestre])

  const formatBRL = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '—'
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <Package className="w-6 h-6 text-[#1D6A43]" />
            Catálogo de Produtos & Base Mestre
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Consulta de produtos disponíveis para simulação comercial e dados fiscais de referência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {abaAtiva === 'produtos' && (
            <>
              {isAdmin && (
                <Button
                  onClick={() => setModalLimparBaseAberto(true)}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  title="Excluir permanentemente todos os produtos da base"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  Limpar Base
                </Button>
              )}

              <Button
                onClick={abrirModalNovo}
                size="sm"
                className="h-8 gap-1.5 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
              >
                <Plus className="w-4 h-4" />
                Novo Produto
              </Button>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              abaAtiva === 'produtos' ? carregarProdutos(pageProd) : carregarBaseMestre(pageMestre)
            }
            className="h-8 gap-1.5 text-xs border-[#E4EAE5] text-[#1E2A24]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#1D6A43]" />
            Atualizar Tabela
          </Button>
        </div>
      </div>

      <Tabs value={abaAtiva} onValueChange={(val: any) => setAbaAtiva(val)} className="w-full">
        <TabsList className="grid w-full sm:w-[380px] grid-cols-2">
          <TabsTrigger value="produtos" className="gap-2 text-xs">
            <Package className="w-4 h-4" />
            Base de Produtos ({totalProdutos})
          </TabsTrigger>
          <TabsTrigger value="mestre" className="gap-2 text-xs">
            <Database className="w-4 h-4" />
            Base Mestre ({totalMestre})
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* ABA 1: BASE DE PRODUTOS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="produtos" className="space-y-4 pt-2">
          {/* Barra de Filtros e Painel de Ações em Massa */}
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  placeholder="Buscar por descrição, código, NCM, princípio ativo ou fabricante..."
                  className="pl-9 text-xs h-9 border-[#E4EAE5]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                  <SelectTrigger className="h-9 w-36 text-xs border-[#E4EAE5]">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as origens</SelectItem>
                    <SelectItem value="Nacional">Nacional</SelectItem>
                    <SelectItem value="Importado">Importado</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => carregarProdutos(1)}
                  size="sm"
                  className="h-9 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
                >
                  Filtrar
                </Button>
              </div>
            </div>

            {/* Barra de Ações em Lote quando há seleção */}
            {selecionados.length > 0 && (
              <div className="pt-2 border-t border-[#E4EAE5] flex flex-wrap items-center justify-between gap-2 bg-[#F7F9F6] p-2.5 rounded-xl">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-[#1D6A43] border-emerald-300 text-xs font-semibold"
                  >
                    {selecionados.length} produto(s) selecionado(s)
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
                    Alterar Selecionados ({selecionados.length})
                  </Button>

                  {isAdmin ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={confirmarExclusaoMassa}
                      className="h-8 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Selecionados ({selecionados.length})
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

          {/* Tabela de Produtos */}
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
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3 min-w-[200px]">Descrição Comercial</th>
                    <th className="py-3 px-3">NCM</th>
                    <th className="py-3 px-3">Origem</th>
                    <th className="py-3 px-3">Embalagem</th>
                    <th className="py-3 px-3">Princípio Ativo</th>
                    <th className="py-3 px-3 text-right">Preço Base</th>
                    <th className="py-3 px-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingProd ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando produtos do simulador...
                      </td>
                    </tr>
                  ) : produtos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        Nenhum produto encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    produtos.map((p) => {
                      const isSelected = selecionados.includes(p.id)
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setProdutoSelecionadoDrawer(p)}
                          className={`hover:bg-[#F7F9F6] transition-colors cursor-pointer ${
                            isSelected ? 'bg-emerald-50/50' : ''
                          }`}
                        >
                          <td
                            className="py-2.5 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSelecionarItem(p.id)}
                              className="text-slate-400 hover:text-[#1D6A43]"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-[#1D6A43]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#1D6A43]">
                            {p.codigo || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-[#1E2A24]">{p.descricao}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{p.ncm || '—'}</td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                p.origem === 'Importado'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              }`}
                            >
                              {p.origem || 'Nacional'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-[#5D6B63]">{p.embalagem || '—'}</td>
                          <td className="py-2.5 px-3 text-[#5D6B63]">{p.principio_ativo || '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#1E2A24]">
                            {formatBRL(p.preco_base_sugerido)}
                          </td>
                          <td
                            className="py-2.5 px-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/simulate?codigo=${p.codigo || ''}`)}
                                className="h-7 px-2 text-[11px] text-[#1D6A43] hover:bg-[#E6F2EC]"
                                title="Iniciar simulação com este produto"
                              >
                                <Calculator className="w-3.5 h-3.5 mr-1" />
                                Simular
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => abrirModalEdicao(p)}
                                className="h-7 w-7 text-slate-500 hover:text-[#1D6A43] hover:bg-emerald-50"
                                title="Editar produto"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    confirmarExclusaoItem(
                                      p.id,
                                      `Produto ${p.codigo || ''} - ${p.descricao}`,
                                    )
                                  }
                                  className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                                  title="Excluir produto"
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

            {/* Paginação */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-[#E4EAE5] bg-[#FAFBF9] text-xs text-[#5D6B63]">
              <div>
                Mostrando {produtos.length} de {totalProdutos} produtos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarProdutos(Math.max(1, pageProd - 1))}
                  disabled={pageProd <= 1 || loadingProd}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="font-semibold px-2 text-[#1E2A24]">
                  {pageProd} / {totalPagesProd}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarProdutos(Math.min(totalPagesProd, pageProd + 1))}
                  disabled={pageProd >= totalPagesProd || loadingProd}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  Próxima
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* ABA 2: BASE MESTRE */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="mestre" className="space-y-4 pt-2">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchMestre}
                  onChange={(e) => setSearchMestre(e.target.value)}
                  placeholder="Buscar na base mestre por nome, marca, registro MAPA ou NCM..."
                  className="pl-9 text-xs h-9 border-[#E4EAE5]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select value={statusMestre} onValueChange={setStatusMestre}>
                  <SelectTrigger className="h-9 w-36 text-xs border-[#E4EAE5]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="reprovado">Reprovado</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={() => carregarBaseMestre(1)}
                  size="sm"
                  className="h-9 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
                >
                  Filtrar
                </Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 min-w-[200px]">Nome do Produto</th>
                    <th className="py-3 px-3">Marca Padronizada</th>
                    <th className="py-3 px-3">NCM</th>
                    <th className="py-3 px-3">Registro MAPA</th>
                    <th className="py-3 px-3">Princípio Ativo</th>
                    <th className="py-3 px-3">Fabricante</th>
                    <th className="py-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingMestre ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando registros da base mestre...
                      </td>
                    </tr>
                  ) : mestreItens.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        Nenhum registro encontrado na Base Mestre.
                      </td>
                    </tr>
                  ) : (
                    mestreItens.map((m) => (
                      <tr
                        key={m.id}
                        onClick={() => setMestreSelecionadoDrawer(m)}
                        className="hover:bg-[#F7F9F6] transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-3 font-semibold text-[#1E2A24]">
                          {m.nome_produto}
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{m.marca_padronizada || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{m.ncm || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-800">
                          {m.registro_mapa || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{m.principio_ativo || '—'}</td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{m.fabricante || '—'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              m.status_validacao === 'aprovado'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : m.status_validacao === 'reprovado'
                                  ? 'bg-red-50 text-red-800 border-red-300'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {m.status_validacao || 'Pendente'}
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
                Mostrando {mestreItens.length} de {totalMestre} registros
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarBaseMestre(Math.max(1, pageMestre - 1))}
                  disabled={pageMestre <= 1 || loadingMestre}
                  className="h-7 text-xs border-[#E4EAE5]"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Anterior
                </Button>
                <span className="font-semibold px-2 text-[#1E2A24]">
                  {pageMestre} / {totalPagesMestre}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => carregarBaseMestre(Math.min(totalPagesMestre, pageMestre + 1))}
                  disabled={pageMestre >= totalPagesMestre || loadingMestre}
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
      {/* MODAL DE EDIÇÃO INDIVIDUAL OU NOVO PRODUTO */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1E2A24] flex items-center gap-2">
              <Edit className="w-4 h-4 text-[#1D6A43]" />
              {registroEmEdicao?.id ? 'Alterar Produto' : 'Novo Produto'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os campos cadastrais do produto na base do simulador.
            </DialogDescription>
          </DialogHeader>

          {registroEmEdicao && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Código do Produto:</label>
                  <Input
                    value={registroEmEdicao.codigo || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, codigo: e.target.value })
                    }
                    placeholder="ex: 000018"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">NCM:</label>
                  <Input
                    value={registroEmEdicao.ncm || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, ncm: e.target.value })
                    }
                    placeholder="ex: 3808.91.99"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Descrição Comercial *:</label>
                <Input
                  value={registroEmEdicao.descricao || ''}
                  onChange={(e) =>
                    setRegistroEmEdicao({ ...registroEmEdicao, descricao: e.target.value })
                  }
                  placeholder="Nome comercial do produto"
                  className="h-8 text-xs font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Origem:</label>
                  <Select
                    value={registroEmEdicao.origem || 'Nacional'}
                    onValueChange={(val) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, origem: val })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nacional">Nacional</SelectItem>
                      <SelectItem value="Importado">Importado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Unidade:</label>
                  <Input
                    value={registroEmEdicao.unidade || 'UN'}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, unidade: e.target.value })
                    }
                    placeholder="L, KG, UN..."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Embalagem:</label>
                  <Input
                    value={registroEmEdicao.embalagem || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, embalagem: e.target.value })
                    }
                    placeholder="4X5L, 20L..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Princípio Ativo:</label>
                  <Input
                    value={registroEmEdicao.principio_ativo || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        principio_ativo: e.target.value,
                      })
                    }
                    placeholder="Ingrediente ativo"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Fabricante:</label>
                  <Input
                    value={registroEmEdicao.fabricante || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, fabricante: e.target.value })
                    }
                    placeholder="Empresa titular"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">GrTrib:</label>
                  <Input
                    value={registroEmEdicao.gr_trib || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, gr_trib: e.target.value })
                    }
                    placeholder="001, 002..."
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Segmento:</label>
                  <Input
                    value={registroEmEdicao.segmento || ''}
                    onChange={(e) =>
                      setRegistroEmEdicao({ ...registroEmEdicao, segmento: e.target.value })
                    }
                    placeholder="CROP, FERTILIZER..."
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Preço Base (R$):</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={registroEmEdicao.preco_base_sugerido ?? 0}
                    onChange={(e) =>
                      setRegistroEmEdicao({
                        ...registroEmEdicao,
                        preco_base_sugerido: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
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
      {/* MODAL DE EDIÇÃO EM MASSA DE PRODUTOS */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={modalMassaAberto} onOpenChange={setModalMassaAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1E2A24] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#1D6A43]" />
              Alterar {selecionados.length} Produtos em Massa
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha apenas os campos que você deseja aplicar a todos os produtos selecionados.
              Campos deixados em branco não serão modificados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Origem:</label>
                <Select
                  value={camposMassa.origem}
                  onValueChange={(val) => setCamposMassa({ ...camposMassa, origem: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="(Não alterar)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nacional">Nacional</SelectItem>
                    <SelectItem value="Importado">Importado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Unidade:</label>
                <Input
                  value={camposMassa.unidade}
                  onChange={(e) => setCamposMassa({ ...camposMassa, unidade: e.target.value })}
                  placeholder="ex: L, KG, UN..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Embalagem:</label>
                <Input
                  value={camposMassa.embalagem}
                  onChange={(e) => setCamposMassa({ ...camposMassa, embalagem: e.target.value })}
                  placeholder="ex: 4X5L, 20L..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Grupo Trib. (GrTrib):</label>
                <Input
                  value={camposMassa.gr_trib}
                  onChange={(e) => setCamposMassa({ ...camposMassa, gr_trib: e.target.value })}
                  placeholder="ex: 001, 002..."
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Segmento:</label>
                <Input
                  value={camposMassa.segmento}
                  onChange={(e) => setCamposMassa({ ...camposMassa, segmento: e.target.value })}
                  placeholder="ex: CROP, FERTILIZER..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Fabricante:</label>
                <Input
                  value={camposMassa.fabricante}
                  onChange={(e) => setCamposMassa({ ...camposMassa, fabricante: e.target.value })}
                  placeholder="ex: Titular"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Moeda:</label>
                <Input
                  value={camposMassa.moeda}
                  onChange={(e) => setCamposMassa({ ...camposMassa, moeda: e.target.value })}
                  placeholder="ex: BRL, USD"
                  className="h-8 text-xs uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Preço Base Sugerido (R$):</label>
                <Input
                  type="number"
                  step="0.01"
                  value={camposMassa.preco_base_sugerido}
                  onChange={(e) =>
                    setCamposMassa({ ...camposMassa, preco_base_sugerido: e.target.value })
                  }
                  placeholder="ex: 150.00"
                  className="h-8 text-xs font-mono"
                />
              </div>
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
              Aplicar a {selecionados.length} Registros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* MODAL DE LIMPEZA TOTAL DA BASE (simulador_produtos) */}
      {/* ------------------------------------------------------------- */}
      <ModalLimparBase
        aberto={modalLimparBaseAberto}
        onOpenChange={setModalLimparBaseAberto}
        nomeEntidade="Produtos do Simulador"
        nomeColecao="simulador_produtos"
        isAdmin={isAdmin}
        aoObterContagem={() => simuladorImportadorService.contarTotalProdutos()}
        aoConfirmarLimpeza={(onProgresso) =>
          simuladorImportadorService.limparBaseProdutos(onProgresso)
        }
        aoSucesso={(res) => {
          toast({
            title: 'Base de Produtos limpa com sucesso',
            description: `${res.apagados.toLocaleString('pt-BR')} registros foram excluídos permanentemente.${
              res.falhas > 0 ? ` (${res.falhas} falhas)` : ''
            }`,
          })
          setSelecionados([])
          setSearchProd('')
          setOrigemFiltro('todos')
          carregarProdutos(1)
        }}
      />

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
                  Você tem certeza que deseja excluir permanentemente os{' '}
                  <strong className="text-red-700">
                    {selecionados.length} produtos selecionados
                  </strong>{' '}
                  da base <code className="font-mono text-xs">simulador_produtos</code>? Esta ação
                  não pode ser desfeita.
                </>
              ) : (
                <>
                  Você tem certeza que deseja excluir o produto{' '}
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

      {/* ------------------------------------------------------------- */}
      {/* DRAWER LATERAL DE DETALHES DO PRODUTO */}
      {/* ------------------------------------------------------------- */}
      {produtoSelecionadoDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setProdutoSelecionadoDrawer(null)}
          />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-right duration-250">
            <div className="p-4 border-b border-[#E4EAE5] flex items-center justify-between bg-[#F7F9F6]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1D6A43]" />
                <h3 className="font-bold text-sm text-[#1E2A24]">Ficha Técnica do Produto</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setProdutoSelecionadoDrawer(null)}
                className="h-7 w-7 text-slate-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase">Código</span>
                <p className="font-mono font-bold text-base text-[#1D6A43]">
                  {produtoSelecionadoDrawer.codigo || 'S/ CÓDIGO'}
                </p>
                <h4 className="font-bold text-sm text-[#1E2A24] mt-1">
                  {produtoSelecionadoDrawer.descricao}
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 text-[11px]">NCM:</span>
                  <p className="font-semibold font-mono text-[#1E2A24]">
                    {produtoSelecionadoDrawer.ncm || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Origem:</span>
                  <p className="font-semibold text-[#1E2A24]">
                    {produtoSelecionadoDrawer.origem || 'Nacional'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Unidade:</span>
                  <p className="font-semibold text-[#1E2A24]">
                    {produtoSelecionadoDrawer.unidade || 'L'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Embalagem:</span>
                  <p className="font-semibold text-[#1E2A24]">
                    {produtoSelecionadoDrawer.embalagem || '—'}
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-100">
                <span className="text-slate-500 text-[11px]">Princípio Ativo:</span>
                <p className="font-semibold text-[#1E2A24]">
                  {produtoSelecionadoDrawer.principio_ativo || 'Não informado'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 text-[11px]">Grupo Tributário (GrTrib):</span>
                  <p className="font-mono font-semibold text-[#1E2A24]">
                    {produtoSelecionadoDrawer.gr_trib || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Segmento:</span>
                  <p className="font-semibold text-[#1E2A24]">
                    {produtoSelecionadoDrawer.segmento || '—'}
                  </p>
                </div>
              </div>

              {produtoSelecionadoDrawer.dados_extras && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-slate-500 text-[11px] font-semibold">
                    Dados Extras Mapeados:
                  </span>
                  <div className="bg-[#FAFBF9] p-3 rounded-xl border border-[#E4EAE5] max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {Object.entries(produtoSelecionadoDrawer.dados_extras).map(([key, val]) => (
                      <div
                        key={key}
                        className="flex justify-between py-0.5 border-b border-slate-100 last:border-0"
                      >
                        <span className="text-slate-500 truncate mr-2">{key}:</span>
                        <span className="font-semibold text-[#1E2A24] truncate text-right">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#E4EAE5] bg-[#FAFBF9]">
              <Button
                onClick={() => {
                  navigate(`/simulate?codigo=${produtoSelecionadoDrawer.codigo || ''}`)
                }}
                className="w-full bg-[#1D6A43] hover:bg-[#155C36] text-white gap-2 text-xs"
              >
                <Calculator className="w-4 h-4" />
                Iniciar simulação com este produto
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Products
