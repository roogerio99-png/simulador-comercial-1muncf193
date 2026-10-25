import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Calculator,
  Search,
  CheckCircle2,
  Download,
  Bookmark,
  RefreshCw,
  Sparkles,
  Info,
  Package,
} from 'lucide-react'
import { simuladorDataService } from '@/services/simuladorDataService'
import { calcularPrecoSimulador, CalculoResultado } from '@/lib/motorCalculoSimulador'
import { simulacoesStorage } from '@/lib/simulacoesStorage'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { SimProdutoBase, SimRegraIcms, ParametrizacaoFiscal } from '@/types/simulador'

const UFS_BRASIL = [
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

export function Simulate() {
  const [searchParams] = useSearchParams()
  const codigoFromQuery = searchParams.get('codigo') || ''
  const { toast } = useToast()

  // Passo 1: Busca e Seleção de Produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtosEncontrados, setProdutosEncontrados] = useState<SimProdutoBase[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<SimProdutoBase | null>(null)
  const [buscandoProdutos, setBuscandoProdutos] = useState(false)

  // Passo 2: Parâmetros da Operação
  const [ufOrigem, setUfOrigem] = useState<string>('SP')
  const [ufDestino, setUfDestino] = useState<string>('MT')
  const [ncmManual, setNcmManual] = useState<string>('')
  const [precoBaseUnitario, setPrecoBaseUnitario] = useState<number>(100)
  const [quantidade, setQuantidade] = useState<number>(10)
  const [margemLucroPerc, setMargemLucroPerc] = useState<number>(20)
  const [freteTotal, setFreteTotal] = useState<number>(0)

  // Passo 3: Configuração Tributária & Projeção 2027
  const [incluirIbsCbs, setIncluirIbsCbs] = useState<boolean>(false)
  const [regraIcms, setRegraIcms] = useState<SimRegraIcms | null>(null)
  const [paramFiscal, setParamFiscal] = useState<ParametrizacaoFiscal | null>(null)
  const [carregandoRegras, setCarregandoRegras] = useState(false)

  // Pré-selecionar via query param
  useEffect(() => {
    if (codigoFromQuery) {
      simuladorDataService.buscarProdutoPorCodigo(codigoFromQuery).then((p) => {
        if (p) {
          setProdutoSelecionado(p)
          if (p.preco_base_sugerido && p.preco_base_sugerido > 0) {
            setPrecoBaseUnitario(p.preco_base_sugerido)
          }
          if (p.ncm) {
            setNcmManual(p.ncm)
          }
        }
      })
    }
  }, [codigoFromQuery])

  // Busca de produtos com debounce
  useEffect(() => {
    if (!buscaProduto.trim()) {
      setProdutosEncontrados([])
      return
    }

    const timer = setTimeout(async () => {
      setBuscandoProdutos(true)
      try {
        const termo = buscaProduto.trim().replace(/'/g, "\\'")
        const filter = `codigo ~ '${termo}' || descricao ~ '${termo}' || ncm ~ '${termo}' || principio_ativo ~ '${termo}'`
        const res = await simuladorDataService.listarProdutos(1, 10, filter, 'descricao')
        setProdutosEncontrados(res.items)
      } catch (err) {
        console.error('Erro na busca de produtos:', err)
      } finally {
        setBuscandoProdutos(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [buscaProduto])

  // Buscar regra de ICMS e parametrização fiscal automaticamente ao alterar UFs ou Produto
  useEffect(() => {
    const carregarRegrasFiscais = async () => {
      setCarregandoRegras(true)
      try {
        const grTrib = produtoSelecionado?.gr_trib || produtoSelecionado?.grupo_codigo
        const icms = await simuladorDataService.obterRegraIcms(ufOrigem, ufDestino, grTrib)
        setRegraIcms(icms)

        const ncmAlvo = produtoSelecionado?.ncm || ncmManual
        if (ncmAlvo) {
          const param = await simuladorDataService.obterParametrizacaoPorNcm(ncmAlvo)
          setParamFiscal(param)
        } else {
          setParamFiscal(null)
        }
      } catch (err) {
        console.error('Erro ao buscar regras fiscais:', err)
      } finally {
        setCarregandoRegras(false)
      }
    }

    carregarRegrasFiscais()
  }, [ufOrigem, ufDestino, produtoSelecionado, ncmManual])

  // Cálculo reativo via Motor de Cálculo Comercial
  const resultadoCalculo: CalculoResultado = useMemo(() => {
    const aliquotaIcms = regraIcms?.aliquota_icms ?? 12
    const reducaoBase = regraIcms?.reducao_base ?? 0
    const diferimento = regraIcms?.percentual_diferimento ?? 0

    // PIS e COFINS padrão agro (Lei 10.925/2004 e LC 224/2025) ou de parametrizacao_fiscal
    const aliquotaPis = paramFiscal?.aliquota_pis ?? 0.165
    const aliquotaCofins = paramFiscal?.aliquota_cofins ?? 0.76

    const aliquotaIbs = paramFiscal?.aliquota_ibs ?? 0.1
    const aliquotaCbs = paramFiscal?.aliquota_cbs ?? 0.9

    return calcularPrecoSimulador({
      precoBaseUnitario,
      quantidade,
      margemLucroPerc,
      freteTotal,
      aliquotaIcmsPerc: aliquotaIcms,
      reducaoBaseIcmsPerc: reducaoBase,
      diferimentoIcmsPerc: diferimento,
      aliquotaPisPerc: aliquotaPis,
      aliquotaCofinsPerc: aliquotaCofins,
      incluirIbsCbs,
      aliquotaIbsPerc: aliquotaIbs,
      aliquotaCbsPerc: aliquotaCbs,
    })
  }, [
    precoBaseUnitario,
    quantidade,
    margemLucroPerc,
    freteTotal,
    regraIcms,
    paramFiscal,
    incluirIbsCbs,
  ])

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const formatPct = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0,0%'
    return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
  }

  // Exportar simulação em CSV
  const handleExportarCsv = () => {
    const headers = [
      'Data',
      'Produto',
      'Codigo',
      'NCM',
      'UF_Origem',
      'UF_Destino',
      'Quantidade',
      'Preco_Base_Unitario',
      'Margem_Perc',
      'Frete_Total',
      'ICMS_Total',
      'PIS_Total',
      'COFINS_Total',
      'IBS_Total',
      'CBS_Total',
      'Preco_Final_Unitario',
      'Preco_Final_Total',
    ]

    const data = [
      new Date().toLocaleString('pt-BR'),
      `"${produtoSelecionado?.descricao || 'Produto Avulso'}"`,
      `"${produtoSelecionado?.codigo || ''}"`,
      `"${produtoSelecionado?.ncm || ncmManual}"`,
      ufOrigem,
      ufDestino,
      quantidade,
      resultadoCalculo.baseBrutaUnitario.toFixed(2),
      margemLucroPerc.toFixed(2),
      resultadoCalculo.freteTotal.toFixed(2),
      resultadoCalculo.icmsTotal.toFixed(2),
      resultadoCalculo.pisTotal.toFixed(2),
      resultadoCalculo.cofinsTotal.toFixed(2),
      resultadoCalculo.ibsTotal.toFixed(2),
      resultadoCalculo.cbsTotal.toFixed(2),
      resultadoCalculo.precoFinalUnitario.toFixed(2),
      resultadoCalculo.precoFinalTotal.toFixed(2),
    ]

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), data.join(',')].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `simulacao_${produtoSelecionado?.codigo || 'avulso'}_${Date.now()}.csv`,
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Planilha exportada!',
      description: 'O arquivo CSV com o detalhamento foi descarregado.',
    })
  }

  // Salvar Simulação no LocalStorage
  const handleSalvarSimulacao = () => {
    const item = {
      id: `sim_${Date.now()}`,
      data: new Date().toISOString(),
      produtoCodigo: produtoSelecionado?.codigo,
      produtoDescricao: produtoSelecionado?.descricao || 'Simulação Avulsa NCM ' + ncmManual,
      ncm: produtoSelecionado?.ncm || ncmManual,
      ufOrigem,
      ufDestino,
      quantidade,
      precoBaseUnitario,
      margemLucroPerc,
      frete: freteTotal,
      incluirIbsCbs,
      aliquotaIcms: regraIcms?.aliquota_icms ?? 12,
      aliquotaPis: paramFiscal?.aliquota_pis ?? 0.165,
      aliquotaCofins: paramFiscal?.aliquota_cofins ?? 0.76,
      aliquotaIbs: paramFiscal?.aliquota_ibs ?? 0.1,
      aliquotaCbs: paramFiscal?.aliquota_cbs ?? 0.9,
      valorBaseTotal: resultadoCalculo.baseBrutaTotal,
      valorMargemTotal: resultadoCalculo.margemLucroTotal,
      valorFreteTotal: resultadoCalculo.freteTotal,
      valorIcmsTotal: resultadoCalculo.icmsTotal,
      valorPisTotal: resultadoCalculo.pisTotal,
      valorCofinsTotal: resultadoCalculo.cofinsTotal,
      valorIbsTotal: resultadoCalculo.ibsTotal,
      valorCbsTotal: resultadoCalculo.cbsTotal,
      precoFinalUnitario: resultadoCalculo.precoFinalUnitario,
      precoFinalTotal: resultadoCalculo.precoFinalTotal,
    }

    simulacoesStorage.salvar(item)

    toast({
      title: 'Simulação salva com sucesso!',
      description: 'Você pode reabrir esta simulação a qualquer momento no menu Histórico.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <Calculator className="w-6 h-6 text-[#1D6A43]" />
            Simulador Comercial de Preço
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Cálculo de preço com markups, comissões, frete e regras estaduais de
            ICMS/PIS/COFINS/IBS/CBS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarCsv}
            className="h-8 gap-1.5 text-xs border-[#E4EAE5] text-[#1E2A24]"
          >
            <Download className="w-3.5 h-3.5 text-[#1D6A43]" />
            Exportar CSV
          </Button>
          <Button
            size="sm"
            onClick={handleSalvarSimulacao}
            className="h-8 gap-1.5 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Salvar Simulação
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel Esquerdo: Passos 1, 2 e 3 (7 colunas) */}
        <div className="lg:col-span-7 space-y-6">
          {/* PASSO 1: Seleção de Produto */}
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1D6A43] text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  Seleção do Produto Agropecuário
                </CardTitle>
                {produtoSelecionado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setProdutoSelecionado(null)
                      setBuscaProduto('')
                    }}
                    className="h-6 text-[11px] text-[#C0392B] hover:bg-red-50"
                  >
                    Trocar Produto
                  </Button>
                )}
              </div>
              <CardDescription className="text-xs">
                Busque na base pelo código, descrição comercial, NCM ou princípio ativo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!produtoSelecionado ? (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Ex: ASLAN, 000018, 3808.91.99, Glifosato..."
                      value={buscaProduto}
                      onChange={(e) => setBuscaProduto(e.target.value)}
                      className="pl-9 text-xs h-9 border-[#E4EAE5] focus-visible:ring-[#1D6A43]"
                    />
                    {buscandoProdutos && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[#1D6A43]" />
                    )}
                  </div>

                  {/* Lista de Resultados */}
                  {produtosEncontrados.length > 0 && (
                    <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 rounded-xl border border-[#E4EAE5] bg-[#FAFBF9]">
                      {produtosEncontrados.map((prod) => (
                        <div
                          key={prod.id}
                          onClick={() => {
                            setProdutoSelecionado(prod)
                            if (prod.preco_base_sugerido && prod.preco_base_sugerido > 0) {
                              setPrecoBaseUnitario(prod.preco_base_sugerido)
                            }
                            if (prod.ncm) setNcmManual(prod.ncm)
                            setBuscaProduto('')
                            setProdutosEncontrados([])
                          }}
                          className="p-3 hover:bg-[#E6F2EC]/60 transition-colors cursor-pointer space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[#1D6A43]">
                              {prod.codigo || 'S/ COD'}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {prod.ncm || 'NCM N/D'}
                            </span>
                          </div>
                          <p className="font-semibold text-[#1E2A24]">{prod.descricao}</p>
                          <div className="flex items-center gap-2 text-[10px] text-[#5D6B63]">
                            <span>Emb: {prod.embalagem || 'Padrão'}</span>
                            <span>•</span>
                            <span>{prod.origem || 'Nacional'}</span>
                            {prod.preco_base_sugerido ? (
                              <>
                                <span>•</span>
                                <span className="font-medium text-emerald-800">
                                  Sugerido: {formatBRL(prod.preco_base_sugerido)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-1">
                    <p className="text-[11px] text-[#5D6B63]">
                      Ou prossiga sem selecionar um produto cadastrado informando o NCM manualmente
                      no passo seguinte.
                    </p>
                  </div>
                </>
              ) : (
                /* Card do Produto Selecionado */
                <div className="p-3 rounded-xl bg-[#E6F2EC]/50 border border-emerald-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-[#1D6A43] text-white font-mono text-[11px]">
                      {produtoSelecionado.codigo || 'SEM CÓDIGO'}
                    </Badge>
                    <span className="font-mono text-xs font-semibold text-emerald-950">
                      NCM: {produtoSelecionado.ncm || '—'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#1E2A24]">
                      {produtoSelecionado.descricao}
                    </h3>
                    <p className="text-[11px] text-[#5D6B63] mt-0.5">
                      {produtoSelecionado.principio_ativo || 'Princípio Ativo de Referência'} •{' '}
                      {produtoSelecionado.embalagem || 'Embalagem Comercial'} •{' '}
                      {produtoSelecionado.origem || 'Nacional'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PASSO 2: Parâmetros da Operação */}
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1D6A43] text-white flex items-center justify-center text-[10px]">
                  2
                </span>
                Parâmetros Comerciais & Logística
              </CardTitle>
              <CardDescription className="text-xs">
                Defina o trajeto estadual, valores básicos, margem e volume
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">UF Origem</Label>
                  <Select value={ufOrigem} onValueChange={setUfOrigem}>
                    <SelectTrigger className="h-9 text-xs border-[#E4EAE5]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS_BRASIL.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">UF Destino</Label>
                  <Select value={ufDestino} onValueChange={setUfDestino}>
                    <SelectTrigger className="h-9 text-xs border-[#E4EAE5]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS_BRASIL.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!produtoSelecionado && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">NCM Manual</Label>
                  <Input
                    placeholder="Ex: 3808.91.99"
                    value={ncmManual}
                    onChange={(e) => setNcmManual(e.target.value)}
                    className="h-9 text-xs border-[#E4EAE5]"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">Preço Base (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precoBaseUnitario}
                    onChange={(e) => setPrecoBaseUnitario(Number(e.target.value))}
                    className="h-9 text-xs border-[#E4EAE5]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Number(e.target.value))}
                    className="h-9 text-xs border-[#E4EAE5]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">Margem (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={margemLucroPerc}
                    onChange={(e) => setMargemLucroPerc(Number(e.target.value))}
                    className="h-9 text-xs border-[#E4EAE5]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#1E2A24]">Frete Total (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={freteTotal}
                    onChange={(e) => setFreteTotal(Number(e.target.value))}
                    className="h-9 text-xs border-[#E4EAE5]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PASSO 3: Configuração Tributária & IBS/CBS */}
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#1D6A43] text-white flex items-center justify-center text-[10px]">
                  3
                </span>
                Configuração Tributária & Reforma 2027
              </CardTitle>
              <CardDescription className="text-xs">
                Regras fiscais estaduais de ICMS e tributos federais aplicados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chips de ICMS */}
              <div className="p-3.5 rounded-xl bg-[#F7F9F6] border border-[#E4EAE5] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E2A24]">
                    ICMS ({ufOrigem} → {ufDestino})
                  </span>
                  {carregandoRegras ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1D6A43]" />
                  ) : regraIcms ? (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                    >
                      Regra Encontrada
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                    >
                      Alíquota Padrão (12%)
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
                    Alíquota Nominal: <strong>{formatPct(regraIcms?.aliquota_icms ?? 12)}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
                    Redução de Base: <strong>{formatPct(regraIcms?.reducao_base ?? 0)}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold">
                    Alíquota Efetiva: {formatPct(resultadoCalculo.aliquotaIcmsEfetivaPerc)}
                  </span>
                </div>

                {regraIcms?.fundamentacao_legal && (
                  <p className="text-[10px] text-[#5D6B63] italic pt-1">
                    Fundamentação: {regraIcms.fundamentacao_legal}
                  </p>
                )}
              </div>

              {/* Chips de PIS e COFINS */}
              <div className="p-3.5 rounded-xl bg-[#F7F9F6] border border-[#E4EAE5] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E2A24]">
                    PIS / COFINS (Regime Agro)
                  </span>
                  <span className="text-[11px] text-[#5D6B63] font-mono">
                    NCM: {produtoSelecionado?.ncm || ncmManual || 'Não informado'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
                    PIS: <strong>{formatPct(paramFiscal?.aliquota_pis ?? 0.165)}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
                    COFINS: <strong>{formatPct(paramFiscal?.aliquota_cofins ?? 0.76)}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">
                    Regime: <strong>{paramFiscal?.regime || 'Não Cumulativo'}</strong>
                  </span>
                </div>
              </div>

              {/* Toggle Reforma Tributária IBS/CBS */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-emerald-50/50 to-white border border-emerald-200">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="toggle-ibs"
                    className="text-xs font-bold text-[#1E2A24] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#1D6A43]" />
                    Incluir projeção IBS/CBS (2027)
                  </Label>
                  <p className="text-[10px] text-[#5D6B63]">
                    Adiciona projeção da reforma tributária com IBS (0,1%) e CBS (0,9%)
                  </p>
                </div>
                <Switch
                  id="toggle-ibs"
                  checked={incluirIbsCbs}
                  onCheckedChange={setIncluirIbsCbs}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel Direito: Breakdown e Composição (5 colunas - Sticky) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-[#113A23] to-[#1D6A43] text-white p-5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-200">
                Resultado Comercial
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <div>
                  <div className="text-xs text-emerald-100">Preço Final Sugerido</div>
                  <div className="text-2xl font-black text-white">
                    {formatBRL(resultadoCalculo.precoFinalTotal)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-emerald-200">Unitário</div>
                  <div className="text-base font-bold text-[#C98A2D]">
                    {formatBRL(resultadoCalculo.precoFinalUnitario)}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Gráfico de Composição Empilhada */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1E2A24]">Composição do Preço</span>
                  <span className="text-[10px] text-[#5D6B63]">Percentual total</span>
                </div>

                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${resultadoCalculo.composicao.baseMargem}%` }}
                    className="bg-slate-400 h-full transition-all duration-300"
                    title={`Base + Margem: ${resultadoCalculo.composicao.baseMargem.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${resultadoCalculo.composicao.icms}%` }}
                    className="bg-[#D9822B] h-full transition-all duration-300"
                    title={`ICMS: ${resultadoCalculo.composicao.icms.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${resultadoCalculo.composicao.pis}%` }}
                    className="bg-[#38A3A5] h-full transition-all duration-300"
                    title={`PIS: ${resultadoCalculo.composicao.pis.toFixed(1)}%`}
                  />
                  <div
                    style={{ width: `${resultadoCalculo.composicao.cofins}%` }}
                    className="bg-[#7C5CBF] h-full transition-all duration-300"
                    title={`COFINS: ${resultadoCalculo.composicao.cofins.toFixed(1)}%`}
                  />
                  {incluirIbsCbs && (
                    <>
                      <div
                        style={{ width: `${resultadoCalculo.composicao.ibs}%` }}
                        className="bg-[#2FA36B] h-full transition-all duration-300"
                        title={`IBS: ${resultadoCalculo.composicao.ibs.toFixed(1)}%`}
                      />
                      <div
                        style={{ width: `${resultadoCalculo.composicao.cbs}%` }}
                        className="bg-[#D9534F] h-full transition-all duration-300"
                        title={`CBS: ${resultadoCalculo.composicao.cbs.toFixed(1)}%`}
                      />
                    </>
                  )}
                </div>

                {/* Legenda do Gráfico */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px] text-[#5D6B63] pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-slate-400 shrink-0" />
                    <span>Base+Margem</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D9822B] shrink-0" />
                    <span>ICMS ({resultadoCalculo.composicao.icms.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#38A3A5] shrink-0" />
                    <span>PIS ({resultadoCalculo.composicao.pis.toFixed(1)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#7C5CBF] shrink-0" />
                    <span>COFINS ({resultadoCalculo.composicao.cofins.toFixed(1)}%)</span>
                  </div>
                  {incluirIbsCbs && (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#2FA36B] shrink-0" />
                        <span>IBS</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#D9534F] shrink-0" />
                        <span>CBS</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Tabela de Preço Breakdown */}
              <div className="border border-[#E4EAE5] rounded-xl overflow-hidden text-xs">
                <table className="w-full">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 text-[#5D6B63]">Base de Custo ({quantidade} un.)</td>
                      <td className="p-2.5 text-right font-medium text-[#1E2A24]">
                        {formatBRL(resultadoCalculo.baseBrutaTotal)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 text-[#5D6B63]">Margem de Lucro ({margemLucroPerc}%)</td>
                      <td className="p-2.5 text-right font-medium text-[#1E2A24]">
                        {formatBRL(resultadoCalculo.margemLucroTotal)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 text-[#5D6B63]">Frete Logístico</td>
                      <td className="p-2.5 text-right font-medium text-[#1E2A24]">
                        {formatBRL(resultadoCalculo.freteTotal)}
                      </td>
                    </tr>
                    <tr className="hover:bg-amber-50/50 bg-amber-50/20">
                      <td className="p-2.5 text-amber-900 font-medium">ICMS Efetivo</td>
                      <td className="p-2.5 text-right font-semibold text-amber-900">
                        {formatBRL(resultadoCalculo.icmsTotal)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 text-[#5D6B63]">PIS Federal</td>
                      <td className="p-2.5 text-right font-medium text-[#1E2A24]">
                        {formatBRL(resultadoCalculo.pisTotal)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 text-[#5D6B63]">COFINS Federal</td>
                      <td className="p-2.5 text-right font-medium text-[#1E2A24]">
                        {formatBRL(resultadoCalculo.cofinsTotal)}
                      </td>
                    </tr>
                    {incluirIbsCbs && (
                      <>
                        <tr className="hover:bg-emerald-50/50 bg-emerald-50/20">
                          <td className="p-2.5 text-emerald-900 font-medium">IBS Projetado</td>
                          <td className="p-2.5 text-right font-semibold text-emerald-900">
                            {formatBRL(resultadoCalculo.ibsTotal)}
                          </td>
                        </tr>
                        <tr className="hover:bg-rose-50/50 bg-rose-50/20">
                          <td className="p-2.5 text-rose-900 font-medium">CBS Projetada</td>
                          <td className="p-2.5 text-right font-semibold text-rose-900">
                            {formatBRL(resultadoCalculo.cbsTotal)}
                          </td>
                        </tr>
                      </>
                    )}
                    <tr className="bg-[#E6F2EC] font-bold text-emerald-950">
                      <td className="p-3">Preço Final Consolidado</td>
                      <td className="p-3 text-right text-sm">
                        {formatBRL(resultadoCalculo.precoFinalTotal)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Botões de Ação */}
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  onClick={handleSalvarSimulacao}
                  className="w-full bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs h-10 shadow-sm"
                >
                  <Bookmark className="w-4 h-4 mr-2" />
                  Salvar esta Simulação
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportarCsv}
                  className="w-full text-xs h-9 border-[#E4EAE5]"
                >
                  <Download className="w-3.5 h-3.5 mr-2 text-[#1D6A43]" />
                  Descarregar Relatório CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Simulate
