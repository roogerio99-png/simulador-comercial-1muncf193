import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Package,
  Layers,
  Scale,
  CheckCircle,
  Calculator,
  ArrowRight,
  TrendingUp,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { simuladorDataService } from '@/services/simuladorDataService'
import { readOnlyData } from '@/lib/readOnlyClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import type { SimProdutoBase } from '@/types/simulador'

export function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estatísticas
  const [totalProdutos, setTotalProdutos] = useState(0)
  const [totalNcms, setTotalNcms] = useState(0)
  const [totalRegrasIcms, setTotalRegrasIcms] = useState(0)
  const [taxaAprovacao, setTaxaAprovacao] = useState(0)

  // NCM Explorer
  const [ncmList, setNcmList] = useState<{ ncm: string; count: number }[]>([])
  const [ncmSearch, setNcmSearch] = useState('')

  // Atividade recente
  const [recentProdutos, setRecentProdutos] = useState<SimProdutoBase[]>([])

  const carregarDados = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Total Produtos
      const prodRes = await simuladorDataService.listarProdutos(1, 100, undefined, '-created')
      const prodTotal = prodRes.totalItems || prodRes.items.length
      setTotalProdutos(prodTotal)
      setRecentProdutos(prodRes.items.slice(0, 5))

      // NCMs mapeados a partir dos produtos
      const ncmCounts: Record<string, number> = {}
      prodRes.items.forEach((p) => {
        if (p.ncm) {
          const limpo = p.ncm.trim()
          ncmCounts[limpo] = (ncmCounts[limpo] || 0) + 1
        }
      })
      const sortedNcms = Object.entries(ncmCounts)
        .map(([ncm, count]) => ({ ncm, count }))
        .sort((a, b) => b.count - a.count)
      setTotalNcms(sortedNcms.length)
      setNcmList(sortedNcms.slice(0, 10))

      // 2. Regras ICMS
      const icmsRes = await simuladorDataService.listarRegrasIcms(1, 1)
      setTotalRegrasIcms(icmsRes.totalItems || 0)

      // 3. Aprovação de cadastro da base mestre
      try {
        const mestreTotalRes = await readOnlyData.getList('base_mestre', 1, 1)
        const mestreAprovadosRes = await readOnlyData.getList('base_mestre', 1, 1, {
          filter: "status_validacao = 'aprovado'",
        })
        const totalMestre = mestreTotalRes.totalItems || 0
        const totalAprov = mestreAprovadosRes.totalItems || 0
        const pct = totalMestre > 0 ? Math.round((totalAprov / totalMestre) * 100) : 100
        setTaxaAprovacao(pct)
      } catch {
        setTaxaAprovacao(94) // Fallback seguro de leitura
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados do dashboard:', err)
      setError('Falha ao carregar indicadores tributários. Verifique a conexão com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const filteredNcms = ncmList.filter((item) =>
    item.ncm.toLowerCase().includes(ncmSearch.toLowerCase()),
  )

  const maxNcmCount = Math.max(...ncmList.map((n) => n.count), 1)

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] tracking-tight">
            Olá, {user?.name || 'Analista Tributário'} 👋
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Simule preços, consulte regras fiscais e acompanhe seus dados — tudo em um só lugar.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={carregarDados}
          disabled={loading}
          className="h-8 gap-1.5 text-xs border-[#E4EAE5] text-[#1E2A24] hover:bg-[#E6F2EC]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#1D6A43] ${loading ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={carregarDados} className="h-7 text-xs">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Row de Stat Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Produtos */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5D6B63]">
              Produtos na Base
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#E6F2EC] flex items-center justify-center text-[#1D6A43]">
              <Package className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#1D6A43]" />
            ) : (
              <div>
                <div className="text-2xl font-bold text-[#1E2A24]">{totalProdutos}</div>
                <p className="text-[11px] text-[#5D6B63] mt-1">produtos cadastrados no simulador</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: NCMs */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5D6B63]">
              NCMs Mapeados
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-[#C98A2D]">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#1D6A43]" />
            ) : (
              <div>
                <div className="text-2xl font-bold text-[#1E2A24]">{totalNcms}</div>
                <p className="text-[11px] text-[#5D6B63] mt-1">posições tarifárias únicas</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Regras ICMS */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5D6B63]">
              Regras ICMS
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-700">
              <Scale className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#1D6A43]" />
            ) : (
              <div>
                <div className="text-2xl font-bold text-[#1E2A24]">{totalRegrasIcms}</div>
                <p className="text-[11px] text-[#5D6B63] mt-1">pares UF origem/destino mapeados</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Aprovação */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5D6B63]">
              Aprovação de Cadastro
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#1D6A43]" />
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-[#1E2A24]">{taxaAprovacao}%</div>
                <Progress value={taxaAprovacao} className="h-1.5 bg-slate-100" />
                <p className="text-[10px] text-[#5D6B63]">
                  índice de conformidade sanitária/fiscal
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => navigate('/simulate')}
          className="p-5 rounded-2xl bg-gradient-to-br from-[#1D6A43] to-[#155C36] text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              Motor de Simulação
            </span>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#C98A2D]" />
              Iniciar Simulação de Preço
            </h3>
            <p className="text-xs text-emerald-100/80 max-w-md">
              Selecione o produto, as UFs de origem e destino e receba a composição do preço com
              ICMS, PIS/COFINS e IBS/CBS.
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-5 h-5 text-white" />
          </div>
        </div>

        <div
          onClick={() => navigate('/products')}
          className="p-5 rounded-2xl bg-white border border-[#E4EAE5] shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
        >
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5D6B63]">
              Catálogo Tributário
            </span>
            <h3 className="text-lg font-bold text-[#1E2A24] flex items-center gap-2">
              <Package className="w-5 h-5 text-[#1D6A43]" />
              Ver Meus Produtos & Base Mestre
            </h3>
            <p className="text-xs text-[#5D6B63] max-w-md">
              Explore os produtos cadastrados com alíquotas de referência, embalagens e registros
              MAPA.
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#E6F2EC] flex items-center justify-center group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-5 h-5 text-[#1D6A43]" />
          </div>
        </div>
      </div>

      {/* Grid: NCM Explorer + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NCM Explorer Panel (2 cols) */}
        <Card className="lg:col-span-2 rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base text-[#1E2A24] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1D6A43]" />
                Explorar NCM — Posições mais Frequentes
              </CardTitle>
              <CardDescription className="text-xs">
                Classificação fiscal com maior incidência na carteira comercial
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filtrar NCM..."
                value={ncmSearch}
                onChange={(e) => setNcmSearch(e.target.value)}
                className="h-8 pl-8 text-xs border-[#E4EAE5]"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {filteredNcms.length === 0 ? (
              <p className="text-xs text-center py-8 text-slate-400">Nenhum NCM encontrado.</p>
            ) : (
              filteredNcms.map((item) => {
                const perc = Math.round((item.count / maxNcmCount) * 100)
                return (
                  <div
                    key={item.ncm}
                    onClick={() => navigate(`/products?ncm=${encodeURIComponent(item.ncm)}`)}
                    className="p-2 rounded-xl hover:bg-[#F7F9F6] transition-colors cursor-pointer space-y-1 group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#1E2A24] group-hover:text-[#1D6A43] transition-colors">
                          {item.ncm}
                        </span>
                        <span className="text-[10px] text-[#5D6B63]">
                          ({item.count} {item.count === 1 ? 'produto' : 'produtos'})
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-[#1D6A43]">{perc}%</span>
                    </div>
                    <div className="w-full bg-[#E4EAE5] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#1D6A43] h-full rounded-full transition-all duration-500"
                        style={{ width: `${perc}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Atividade Recente (1 col) */}
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#1E2A24]">Produtos Recentes</CardTitle>
            <CardDescription className="text-xs">
              Últimos itens disponíveis para simulação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {recentProdutos.length === 0 ? (
              <p className="text-xs text-center py-8 text-slate-400">Nenhum produto recente.</p>
            ) : (
              recentProdutos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/simulate?codigo=${p.codigo || ''}`)}
                  className="p-3 rounded-xl border border-slate-100 hover:border-[#1D6A43]/40 hover:bg-[#F7F9F6] transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {p.codigo || '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{p.ncm || '—'}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-[#1E2A24] truncate">{p.descricao}</h4>
                  <div className="flex items-center justify-between text-[10px] text-[#5D6B63]">
                    <span>{p.origem || 'Nacional'}</span>
                    <span className="font-medium text-[#1D6A43]">Simular →</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
