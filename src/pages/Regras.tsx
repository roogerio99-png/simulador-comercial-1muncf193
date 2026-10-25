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
  const [abaAtiva, setAbaAtiva] = useState<string>('icms')

  // 1. ICMS Por UF
  const [regrasIcms, setRegrasIcms] = useState<SimRegraIcms[]>([])
  const [totalIcms, setTotalIcms] = useState(0)
  const [pageIcms, setPageIcms] = useState(1)
  const [totalPagesIcms, setTotalPagesIcms] = useState(1)
  const [ufOrigemFiltro, setUfOrigemFiltro] = useState<string>('TODAS')
  const [ufDestinoFiltro, setUfDestinoFiltro] = useState<string>('TODAS')
  const [loadingIcms, setLoadingIcms] = useState(false)

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
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
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
          </Card>

          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto min-h-[360px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-[#5D6B63] font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3">Origem → Destino</th>
                    <th className="py-3 px-3">Alíquota ICMS</th>
                    <th className="py-3 px-3">Redução Base</th>
                    <th className="py-3 px-3">Alíquota Efetiva</th>
                    <th className="py-3 px-3">Diferimento</th>
                    <th className="py-3 px-3">Tipo Operação</th>
                    <th className="py-3 px-3">Grupo Tributário</th>
                    <th className="py-3 px-3 min-w-[200px]">Fundamentação Legal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingIcms ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                        Carregando regras de ICMS...
                      </td>
                    </tr>
                  ) : regrasIcms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        Nenhuma regra de ICMS encontrada com estes filtros.
                      </td>
                    </tr>
                  ) : (
                    regrasIcms.map((r) => (
                      <tr key={r.id} className="hover:bg-[#F7F9F6] transition-colors">
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
                              SIM {r.percentual_diferimento ? `(${r.percentual_diferimento}%)` : ''}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[#5D6B63]">{r.tipo_operacao || 'Venda'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {r.grupo_tributario_codigo || 'Geral'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#5D6B63] italic truncate max-w-xs">
                          {r.fundamentacao_legal || 'Convênio ICMS 100/97 e alterações'}
                        </td>
                      </tr>
                    ))
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
    </div>
  )
}

export default Regras
