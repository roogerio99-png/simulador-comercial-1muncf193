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
import type { SimProdutoBase, BaseMestreProduto } from '@/types/simulador'

export function Products() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ncmParam = searchParams.get('ncm') || ''

  // Aba selecionada
  const [abaAtiva, setAbaAtiva] = useState<'produtos' | 'mestre'>('produtos')

  // Estado Aba 1: Base de Produtos (sim_produtos_base)
  const [produtos, setProdutos] = useState<SimProdutoBase[]>([])
  const [totalProdutos, setTotalProdutos] = useState(0)
  const [totalPagesProd, setTotalPagesProd] = useState(1)
  const [pageProd, setPageProd] = useState(1)
  const [perPageProd, setPerPageProd] = useState(20)
  const [searchProd, setSearchProd] = useState(ncmParam)
  const [origemFiltro, setOrigemFiltro] = useState<string>('todos')
  const [loadingProd, setLoadingProd] = useState(false)

  // Drawer de Detalhes do Produto
  const [produtoSelecionadoDrawer, setProdutoSelecionadoDrawer] = useState<SimProdutoBase | null>(
    null,
  )

  // Estado Aba 2: Base Mestre (base_mestre)
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
            `descricao ~ '${termo}' || codigo ~ '${termo}' || ncm ~ '${termo}' || principio_ativo ~ '${termo}' || fabricante ~ '${termo}'`,
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
            `nome_produto ~ '${termo}' || marca_padronizada ~ '${termo}' || registro_mapa ~ '${termo}' || ncm ~ '${termo}' || principio_ativo ~ '${termo}'`,
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
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
          {/* Barra de Filtros */}
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
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
          </Card>

          {/* Tabela de Produtos */}
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3 min-w-[200px]">Descrição Comercial</th>
                    <th className="py-3 px-3">NCM</th>
                    <th className="py-3 px-3">Origem</th>
                    <th className="py-3 px-3">Embalagem</th>
                    <th className="py-3 px-3">Princípio Ativo</th>
                    <th className="py-3 px-3 text-right">Preço Base</th>
                    <th className="py-3 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingProd ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando produtos do simulador...
                      </td>
                    </tr>
                  ) : produtos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        Nenhum produto encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    produtos.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => setProdutoSelecionadoDrawer(p)}
                        className="hover:bg-[#F7F9F6] transition-colors cursor-pointer"
                      >
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
                        </td>
                      </tr>
                    ))
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
