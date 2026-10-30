import React, { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  Search,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Package,
  Compass,
  ChevronDown,
  ChevronUp,
  Truck,
  Receipt,
  Scale,
  ListOrdered,
  RotateCcw,
  Landmark,
  Calendar,
  Clock,
  ShoppingCart,
  CircleDollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { AbaBaseProdutos } from '@/pages/simulador/AbaBaseProdutos'
import { AbaRegrasFiscais } from '@/pages/simulador/AbaRegrasFiscais'
import { simuladorDataService } from '@/services/simuladorDataService'
import {
  executarCalculoSimulador,
  SimuladorResultado,
  ProdutoBaseSimulador,
  EnquadramentoCliente,
  ModalidadeFrete,
  deduzirCapacidadeEmbalagem,
  formatarDataIso,
  calcularDataVencimento,
} from '@/lib/motorSimulador'
import { SimProdutoBase, SimRegraIcms } from '@/types/simulador'
import { formatarValor2Casas, formatarMoeda2Casas } from '@/lib/utils'

interface InputValor2CasasProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number
  onValueChange: (novoValor: number) => void
  min?: number
}

function InputValor2Casas({
  value,
  onValueChange,
  min = 0,
  className,
  disabled,
  readOnly,
  ...props
}: InputValor2CasasProps) {
  const [focused, setFocused] = useState(false)
  const [rawText, setRawText] = useState('')

  const parseInput = (texto: string): number => {
    const limpo = texto.replace(/[^\d.,-]/g, '').trim()
    if (!limpo || limpo === '-') return min
    const normalizado = limpo.includes(',')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo
    const parsed = parseFloat(normalizado)
    if (isNaN(parsed)) return min
    return Math.max(min, Number(parsed.toFixed(2)))
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      readOnly={readOnly}
      className={className}
      value={disabled || readOnly || !focused ? formatarValor2Casas(value) : rawText}
      onFocus={(e) => {
        if (disabled || readOnly) return
        setFocused(true)
        setRawText((Number(value) || 0).toFixed(2).replace('.', ','))
        props.onFocus?.(e)
      }}
      onChange={(e) => {
        if (disabled || readOnly) return
        const txt = e.target.value
        setRawText(txt)
        onValueChange(parseInput(txt))
      }}
      onBlur={(e) => {
        setFocused(false)
        const finalVal = parseInput(rawText)
        onValueChange(finalVal)
        props.onBlur?.(e)
      }}
    />
  )
}

// Lista canônica de UFs do Brasil
const UFS_BRASIL = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

// Produtos de exemplo/fallback para testes caso a coleção esteja vazia
const PRODUTOS_SEED_DEMO: ProdutoBaseSimulador[] = [
  {
    codigo: '007243',
    descricao: 'SYNPROLE 480 SC 1X20L (IMP) SS',
    ncm: '3808.92.99',
    unidade: 'L',
    tipo_produto: 'Produto Formulado Comercial',
    origem: 'Importado',
    embalagem: '1X20L',
    principio_ativo: 'Azoxistrobina + Flutriafol',
    fabricante: 'Syngenta',
    moeda: 'USD',
    preco_base_sugerido: 8.5,
    gr_trib: '001',
    comissao_padrao: 0.015,
  },
  {
    codigo: '002094',
    descricao: 'ROUNDUP WG - Saco 20 kg (Glifosato 720 g/kg)',
    ncm: '3808.93.24',
    unidade: 'KG',
    tipo_produto: 'Herbicida Granulado Dispersível',
    origem: 'Nacional',
    embalagem: 'Saco 20 kg',
    principio_ativo: 'Glifosato (Sal de Amônio)',
    fabricante: 'Bayer S.A.',
    moeda: 'BRL',
    preco_base_sugerido: 40.0,
    gr_trib: 'DEF_AGRO',
    comissao_padrao: 0.025,
  },
  {
    codigo: '01119',
    descricao: 'ROUNDUP ORIGINAL MAIS - Bombona 20 L (Glifosato 480 g/L)',
    ncm: '3808.93.29',
    unidade: 'L',
    tipo_produto: 'Herbicida Líquido Concentrado',
    origem: 'Nacional',
    embalagem: 'Bombona 20 L',
    principio_ativo: 'Glifosato (Sal Dipotássico)',
    fabricante: 'Bayer S.A.',
    moeda: 'BRL',
    preco_base_sugerido: 28.0,
    gr_trib: 'DEF_AGRO',
    comissao_padrao: 0.025,
  },
]

export function Simulate() {
  const { toast } = useToast()

  // Estados dos dados do banco
  const [produtos, setProdutos] = useState<SimProdutoBase[]>([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)
  const [termoBuscaProduto, setTermoBuscaProduto] = useState('')

  // 1. PRODUTO & VOLUME GERAL DO LOTE
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoBaseSimulador | null>(null)
  const [quantidade, setQuantidade] = useState<number>(1000)
  const [qtdEmbalagens, setQtdEmbalagens] = useState<number>(50)
  const [volumePorEmbalagem, setVolumePorEmbalagem] = useState<number>(20)
  const [modoEdicaoQtd, setModoEdicaoQtd] = useState<'volume' | 'embalagens'>('volume')

  // ---------------------------------------------------------------------------
  // 2. OPERAÇÃO DE COMPRA (AQUISIÇÃO)
  // ---------------------------------------------------------------------------
  const hoje = formatarDataIso()
  const [dataCompra, setDataCompra] = useState<string>(hoje)
  const [prazoCompraDias, setPrazoCompraDias] = useState<number>(30)
  const [moedaCompra, setMoedaCompra] = useState<'BRL' | 'USD'>('BRL')
  const [taxaDolarCompra, setTaxaDolarCompra] = useState<number>(5.75)
  const [precoUnitarioCompra, setPrecoUnitarioCompra] = useState<number>(28.0)
  const [ufOrigemCompra, setUfOrigemCompra] = useState<string>('SP')
  const [ufDestinoCompra, setUfDestinoCompra] = useState<string>('SP')
  const [modalidadeFreteCompra, setModalidadeFreteCompra] = useState<ModalidadeFrete>('FOB')
  const [freteCompra, setFreteCompra] = useState<number>(1200)
  const [seguroCompra, setSeguroCompra] = useState<number>(200)
  const [outrasDespesasCompra, setOutrasDespesasCompra] = useState<number>(100)
  const [taxaJurosCompraMensal, setTaxaJurosCompraMensal] = useState<number>(1.2) // % a.m.
  const [creditarIcmsCompra] = useState<boolean>(true)
  const [aliquotaIcmsCreditoCompra, setAliquotaIcmsCreditoCompra] = useState<number>(4.0)
  const [regraIcmsCompraAtual, setRegraIcmsCompraAtual] = useState<SimRegraIcms | null>(null)
  const [alertaRegraCompra, setAlertaRegraCompra] = useState<string | null>(null)

  // ---------------------------------------------------------------------------
  // 3. OPERAÇÃO DE VENDA (REVENDA COMERCIAL)
  // ---------------------------------------------------------------------------
  const [dataVenda, setDataVenda] = useState<string>(hoje)
  const [prazoVendaDias, setPrazoVendaDias] = useState<number>(60)
  const [moedaVenda, setMoedaVenda] = useState<'BRL' | 'USD'>('BRL')
  const [taxaDolarVenda, setTaxaDolarVenda] = useState<number>(5.75)
  const [precoUnitarioVenda, setPrecoUnitarioVenda] = useState<number>(45.0)
  // Regra de negócio: a UF Origem da venda é obrigatoriamente a UF Destino da compra
  const ufOrigemVenda = ufDestinoCompra
  const [ufDestinoVenda, setUfDestinoVenda] = useState<string>('MT')
  const [enquadramentoCliente, setEnquadramentoCliente] =
    useState<EnquadramentoCliente>('produtor_rural')
  const [modalidadeFreteVenda, setModalidadeFreteVenda] = useState<ModalidadeFrete>('CIF')
  const [freteVenda, setFreteVenda] = useState<number>(2500)
  const [seguroVenda, setSeguroVenda] = useState<number>(350)
  const [outrasDespesasVenda, setOutrasDespesasVenda] = useState<number>(150)
  const [comissaoVendaPerc, setComissaoVendaPerc] = useState<number>(2.5)
  const [taxaJurosVendaMensal, setTaxaJurosVendaMensal] = useState<number>(1.8) // % a.m.
  const [margemAlvoPerc, setMargemAlvoPerc] = useState<number>(15)

  // Parâmetros fiscais de venda (Reforma / LC 224 / LC 214)
  const [considerarReoneracao2026, setConsiderarReoneracao2026] = useState<boolean>(true)
  const [usarAliquotaReformaPlena, setUsarAliquotaReformaPlena] = useState<boolean>(false)

  // Abas de navegação principal
  const [abaAtiva, setAbaAtiva] = useState<string>('simulacao')

  // Resultados
  const [calculando, setCalculando] = useState<boolean>(false)
  const [regraIcmsAtual, setRegraIcmsAtual] = useState<SimRegraIcms | null>(null)
  const [resultado, setResultado] = useState<SimuladorResultado | null>(null)
  const [mostrarMemoriaCalculo, setMostrarMemoriaCalculo] = useState<boolean>(false)

  // Vencimentos calculados dinamicamente para exibição no formulário
  const vencimentoCompraCalculado = useMemo(() => {
    return calcularDataVencimento(dataCompra, prazoCompraDias)
  }, [dataCompra, prazoCompraDias])

  const vencimentoVendaCalculado = useMemo(() => {
    return calcularDataVencimento(dataVenda, prazoVendaDias)
  }, [dataVenda, prazoVendaDias])

  // Juros efetivos proporcionais ao prazo (pró-rata 30 dias)
  const jurosCompraEfetivoPerc = useMemo(() => {
    return (taxaJurosCompraMensal / 30) * prazoCompraDias
  }, [taxaJurosCompraMensal, prazoCompraDias])

  const jurosVendaEfetivoPerc = useMemo(() => {
    return (taxaJurosVendaMensal / 30) * prazoVendaDias
  }, [taxaJurosVendaMensal, prazoVendaDias])

  // Sincronizar quantidade de embalagens quando o volume muda
  const handleAlterarVolume = (novoVolume: number) => {
    const volArredondado = Number(novoVolume.toFixed(2))
    setQuantidade(volArredondado)
    setModoEdicaoQtd('volume')
    if (volumePorEmbalagem > 0) {
      setQtdEmbalagens(Math.max(1, Math.ceil(volArredondado / volumePorEmbalagem)))
    }
  }

  const handleAlterarQtdEmbalagens = (novasEmbalagens: number) => {
    setQtdEmbalagens(novasEmbalagens)
    setModoEdicaoQtd('embalagens')
    if (volumePorEmbalagem > 0) {
      setQuantidade(Number((novasEmbalagens * volumePorEmbalagem).toFixed(2)))
    }
  }

  // Carrega todos os produtos de simulador_produtos (catálogo completo)
  const carregarProdutos = async () => {
    try {
      setCarregandoProdutos(true)
      const params = new URLSearchParams(window.location.search)
      const codigoUrl = params.get('codigo')?.trim()

      const items = await simuladorDataService.listarTodosProdutosBaseSimulador('descricao')
      if (items && items.length > 0) {
        setProdutos(items)
        if (codigoUrl) {
          const prodUrl = items.find(
            (p) => p.codigo?.toLowerCase() === codigoUrl.toLowerCase(),
          )
          if (prodUrl) {
            selecionarProduto(prodUrl)
            setTermoBuscaProduto(prodUrl.codigo || prodUrl.descricao)
            return
          }
        }
        if (!produtoSelecionado) {
          selecionarProduto(items[0])
        }
      } else {
        if (!produtoSelecionado) {
          selecionarProduto(PRODUTOS_SEED_DEMO[0])
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('Coleção simulador_produtos:', msg)
      if (!produtoSelecionado) {
        selecionarProduto(PRODUTOS_SEED_DEMO[0])
      }
    } finally {
      setCarregandoProdutos(false)
    }
  }

  useEffect(() => {
    carregarProdutos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selecionar produto (a moeda pertence exclusivamente à operação de compra ou venda)
  const selecionarProduto = (prod: ProdutoBaseSimulador) => {
    setProdutoSelecionado(prod)

    const precoBase =
      prod.preco_base_sugerido && prod.preco_base_sugerido > 0 ? prod.preco_base_sugerido : 30
    setPrecoUnitarioCompra(precoBase)
    setPrecoUnitarioVenda(Number((precoBase * 1.35).toFixed(2))) // Margem inicial sugerida 35%

    // Comissão padrão sugerida do produto do banco
    if (
      prod.comissao_padrao !== undefined &&
      prod.comissao_padrao !== null &&
      prod.comissao_padrao > 0
    ) {
      const comissaoCalc =
        prod.comissao_padrao < 1 ? prod.comissao_padrao * 100 : prod.comissao_padrao
      setComissaoVendaPerc(comissaoCalc)
    }

    // Capacidade da embalagem automática de acordo com o múltiplo do cadastro do produto
    const cap = deduzirCapacidadeEmbalagem(prod.embalagem, prod.descricao)
    setVolumePorEmbalagem(cap)
    if (cap > 0) {
      if (modoEdicaoQtd === 'embalagens' && qtdEmbalagens > 0) {
        setQuantidade(Number((qtdEmbalagens * cap).toFixed(2)))
      } else {
        const volBase = quantidade > 0 ? quantidade : 1000
        const novasEmb = Math.max(1, Math.ceil(volBase / cap))
        setQtdEmbalagens(novasEmb)
        setQuantidade(Number((novasEmb * cap).toFixed(2)))
      }
    }
  }

  // Lista de produtos filtrada para busca rápida em todo o catálogo (1.177+ itens)
  const produtosDisponiveis = useMemo(() => {
    const lista = produtos.length > 0 ? produtos : PRODUTOS_SEED_DEMO
    const rawTerm = termoBuscaProduto.trim()
    if (!rawTerm) return lista.slice(0, 50)

    const normalize = (str?: string) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    const t = normalize(rawTerm)
    const tDigits = rawTerm.replace(/\D/g, '')

    return lista
      .filter((p) => {
        const desc = normalize(p.descricao)
        const cod = normalize(p.codigo)
        const ncm = normalize(p.ncm)
        const ncmDigits = (p.ncm || '').replace(/\D/g, '')
        const pa = normalize(p.principio_ativo)
        const grupo = normalize(p.grupo_descricao)
        const grTribDesc = normalize(p.descricao_grupo_tributario)
        const seg = normalize(p.segmento)

        return (
          desc.includes(t) ||
          cod.includes(t) ||
          ncm.includes(t) ||
          (tDigits.length >= 2 && ncmDigits.includes(tDigits)) ||
          pa.includes(t) ||
          grupo.includes(t) ||
          grTribDesc.includes(t) ||
          seg.includes(t)
        )
      })
      .slice(0, 100)
  }, [produtos, termoBuscaProduto])

  // Atualiza regra fiscal da compra e alíquota de ICMS correspondente
  useEffect(() => {
    let cancelado = false
    const atualizarRegraCompra = async () => {
      if (!produtoSelecionado) return
      try {
        const regra = await simuladorDataService.obterRegraIcms(
          ufOrigemCompra,
          ufDestinoCompra,
          produtoSelecionado.gr_trib,
        )
        if (cancelado) return
        setRegraIcmsCompraAtual(regra)

        if (regra) {
          setAlertaRegraCompra(null)
          const aliq =
            regra.aliquota_efetiva !== undefined && regra.aliquota_efetiva !== null
              ? Number(regra.aliquota_efetiva)
              : Number(regra.aliquota_icms) || 0
          setAliquotaIcmsCreditoCompra(aliq)
        } else {
          setAliquotaIcmsCreditoCompra(0)
          const aviso = `Sem regra fiscal para ${ufOrigemCompra} → ${ufDestinoCompra}${
            produtoSelecionado.gr_trib ? ` (GrTrib ${produtoSelecionado.gr_trib})` : ''
          }.`
          setAlertaRegraCompra(aviso)
        }
      } catch (e) {
        if (!cancelado) {
          console.warn('Erro ao buscar regra ICMS de compra:', e)
        }
      }
    }

    atualizarRegraCompra()
    return () => {
      cancelado = true
    }
  }, [ufOrigemCompra, ufDestinoCompra, produtoSelecionado])

  // Atualiza regra fiscal da venda quando UF origem/destino de venda ou produto muda
  useEffect(() => {
    let cancelado = false
    const atualizarRegraVenda = async () => {
      if (!produtoSelecionado) return
      try {
        const regra = await simuladorDataService.obterRegraIcms(
          ufOrigemVenda,
          ufDestinoVenda,
          produtoSelecionado.gr_trib,
        )
        if (!cancelado) {
          setRegraIcmsAtual(regra)
        }
      } catch (e) {
        if (!cancelado) {
          console.warn('Erro ao buscar regra ICMS de venda:', e)
        }
      }
    }

    atualizarRegraVenda()
    return () => {
      cancelado = true
    }
  }, [ufOrigemVenda, ufDestinoVenda, produtoSelecionado])

  // Sugestão de Preço Unitário de Venda em tempo real a partir da Margem Alvo (%) dentro da Operação de Venda
  const sugestaoPrecoVenda = useMemo(() => {
    const prod = produtoSelecionado || PRODUTOS_SEED_DEMO[0]
    const taxaCompraValida = moedaCompra === 'USD' ? Math.max(0.0001, taxaDolarCompra || 1) : 1.0
    const taxaVendaValida = moedaVenda === 'USD' ? Math.max(0.0001, taxaDolarVenda || 1) : 1.0

    const sim = executarCalculoSimulador({
      produto: prod,
      quantidade,
      qtdEmbalagens,
      volumePorEmbalagem,
      unidade: prod.unidade,
      embalagem: prod.embalagem,
      ptaxManual: taxaVendaValida,
      compra: {
        dataOperacao: dataCompra,
        prazoDias: prazoCompraDias,
        precoUnitario: precoUnitarioCompra,
        moeda: moedaCompra,
        ptaxManual: taxaCompraValida,
        ufOrigem: ufOrigemCompra,
        ufDestino: ufDestinoCompra,
        regraIcms: regraIcmsCompraAtual,
        modalidadeFrete: modalidadeFreteCompra,
        frete: freteCompra,
        seguro: seguroCompra,
        outrasDespesas: outrasDespesasCompra,
        taxaJurosMensalPerc: taxaJurosCompraMensal,
        creditarIcms: creditarIcmsCompra,
        aliquotaIcmsCreditoManual: aliquotaIcmsCreditoCompra,
      },
      venda: {
        dataOperacao: dataVenda,
        prazoDias: prazoVendaDias,
        precoUnitario: precoUnitarioVenda,
        moeda: moedaVenda,
        ptaxManual: taxaVendaValida,
        ufOrigem: ufOrigemVenda,
        ufDestino: ufDestinoVenda,
        enquadramentoCliente,
        modalidadeFrete: modalidadeFreteVenda,
        frete: freteVenda,
        seguro: seguroVenda,
        outrasDespesas: outrasDespesasVenda,
        comissaoPerc: comissaoVendaPerc,
        taxaJurosMensalPerc: taxaJurosVendaMensal,
        margemAlvoPerc,
        regraIcms: regraIcmsAtual,
        considerarReoneracao2026,
        usarAliquotaReformaPlena,
      },
    })

    const unitarioReais = sim.precoVendaSugeridoUnitario
    const unitarioMoedaVenda =
      moedaVenda === 'USD' ? unitarioReais / taxaVendaValida : unitarioReais
    const breakEvenUnitarioReais =
      sim.volumeTotal > 0 ? sim.precoMinimoBreakEven / sim.volumeTotal : 0
    const breakEvenUnitarioMoedaVenda =
      moedaVenda === 'USD' ? breakEvenUnitarioReais / taxaVendaValida : breakEvenUnitarioReais

    return {
      unitarioReais,
      unitarioMoedaVenda,
      totalReais: sim.precoVendaSugerido,
      breakEvenUnitarioReais,
      breakEvenUnitarioMoedaVenda,
      markupMultiplicador: sim.markupMultiplicador,
      cargaTributariaEfetivaPerc: sim.cargaTributariaEfetivaPerc,
    }
  }, [
    produtoSelecionado,
    quantidade,
    qtdEmbalagens,
    volumePorEmbalagem,
    dataCompra,
    prazoCompraDias,
    precoUnitarioCompra,
    moedaCompra,
    taxaDolarCompra,
    ufOrigemCompra,
    ufDestinoCompra,
    regraIcmsCompraAtual,
    modalidadeFreteCompra,
    freteCompra,
    seguroCompra,
    outrasDespesasCompra,
    taxaJurosCompraMensal,
    creditarIcmsCompra,
    aliquotaIcmsCreditoCompra,
    dataVenda,
    prazoVendaDias,
    precoUnitarioVenda,
    moedaVenda,
    taxaDolarVenda,
    ufOrigemVenda,
    ufDestinoVenda,
    enquadramentoCliente,
    modalidadeFreteVenda,
    freteVenda,
    seguroVenda,
    outrasDespesasVenda,
    comissaoVendaPerc,
    taxaJurosVendaMensal,
    margemAlvoPerc,
    regraIcmsAtual,
    considerarReoneracao2026,
    usarAliquotaReformaPlena,
  ])

  // Executa Simulação Comercial Segregada (Compra, Venda e Resultado)
  const handleSimular = async () => {
    if (!produtoSelecionado) {
      toast({
        title: 'Selecione um Produto',
        description: 'Escolha um item da base para realizar a simulação comercial.',
        variant: 'destructive',
      })
      return
    }

    if (moedaCompra === 'USD' && (!taxaDolarCompra || taxaDolarCompra <= 0)) {
      toast({
        title: 'Taxa do Dólar na Compra Obrigatória',
        description:
          'Para operação de compra em Dólar (USD), informe uma taxa de câmbio válida maior que zero.',
        variant: 'destructive',
      })
      return
    }

    if (moedaVenda === 'USD' && (!taxaDolarVenda || taxaDolarVenda <= 0)) {
      toast({
        title: 'Taxa do Dólar na Venda Obrigatória',
        description:
          'Para operação de venda em Dólar (USD), informe uma taxa de câmbio válida maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setCalculando(true)
    try {
      // Busca regras das duas pontas simultaneamente
      const [regraCompra, regraVenda] = await Promise.all([
        simuladorDataService.obterRegraIcms(
          ufOrigemCompra,
          ufDestinoCompra,
          produtoSelecionado.gr_trib,
        ),
        simuladorDataService.obterRegraIcms(
          ufOrigemVenda,
          ufDestinoVenda,
          produtoSelecionado.gr_trib,
        ),
      ])

      setRegraIcmsCompraAtual(regraCompra)
      setRegraIcmsAtual(regraVenda)

      // Atualiza alíquota da compra exclusivamente pela regra fiscal
      let aliqCompraUsada = 0
      if (regraCompra) {
        aliqCompraUsada =
          regraCompra.aliquota_efetiva !== undefined && regraCompra.aliquota_efetiva !== null
            ? Number(regraCompra.aliquota_efetiva)
            : Number(regraCompra.aliquota_icms) || 0
        setAliquotaIcmsCreditoCompra(aliqCompraUsada)
        setAlertaRegraCompra(null)
      } else {
        setAliquotaIcmsCreditoCompra(0)
        setAlertaRegraCompra(
          `Sem regra fiscal para ${ufOrigemCompra} → ${ufDestinoCompra}${
            produtoSelecionado.gr_trib ? ` (GrTrib ${produtoSelecionado.gr_trib})` : ''
          }.`,
        )
      }

      const res = executarCalculoSimulador({
        produto: produtoSelecionado,
        quantidade,
        qtdEmbalagens,
        volumePorEmbalagem,
        unidade: produtoSelecionado.unidade,
        embalagem: produtoSelecionado.embalagem,
        ptaxManual: moedaVenda === 'USD' ? taxaDolarVenda : 1.0,

        // Bloco Segregado de COMPRA
        compra: {
          dataOperacao: dataCompra,
          prazoDias: prazoCompraDias,
          precoUnitario: precoUnitarioCompra,
          moeda: moedaCompra,
          ptaxManual: moedaCompra === 'USD' ? taxaDolarCompra : 1.0,
          ufOrigem: ufOrigemCompra,
          ufDestino: ufDestinoCompra,
          regraIcms: regraCompra,
          modalidadeFrete: modalidadeFreteCompra,
          frete: freteCompra,
          seguro: seguroCompra,
          outrasDespesas: outrasDespesasCompra,
          taxaJurosMensalPerc: taxaJurosCompraMensal,
          creditarIcms: creditarIcmsCompra,
          aliquotaIcmsCreditoManual: aliqCompraUsada,
        },

        // Bloco Segregado de VENDA
        venda: {
          dataOperacao: dataVenda,
          prazoDias: prazoVendaDias,
          precoUnitario: precoUnitarioVenda,
          moeda: moedaVenda,
          ptaxManual: moedaVenda === 'USD' ? taxaDolarVenda : 1.0,
          ufOrigem: ufOrigemVenda,
          ufDestino: ufDestinoVenda,
          enquadramentoCliente,
          modalidadeFrete: modalidadeFreteVenda,
          frete: freteVenda,
          seguro: seguroVenda,
          outrasDespesas: outrasDespesasVenda,
          comissaoPerc: comissaoVendaPerc,
          taxaJurosMensalPerc: taxaJurosVendaMensal,
          margemAlvoPerc,
          regraIcms: regraVenda,
          considerarReoneracao2026,
          usarAliquotaReformaPlena,
        },
      })

      setResultado(res)

      if (!res.temRegraIcms) {
        toast({
          title: 'Aviso: Regra ICMS de venda não cadastrada',
          description: `Sem regra específica para ${ufOrigemVenda} → ${ufDestinoVenda}. Foi aplicada alíquota padrão estimada.`,
        })
      }
      if (!regraCompra) {
        toast({
          title: 'Aviso: Regra ICMS de compra não cadastrada',
          description: `Sem regra para aquisição ${ufOrigemCompra} → ${ufDestinoCompra}. Verifique a alíquota de crédito de entrada.`,
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar simulação.'
      toast({
        title: 'Erro na Simulação',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setCalculando(false)
    }
  }

  // Executa simulação automática ao carregar ou alterar parâmetros centrais
  useEffect(() => {
    if (produtoSelecionado) {
      handleSimular()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    produtoSelecionado,
    moedaCompra,
    taxaDolarCompra,
    moedaVenda,
    taxaDolarVenda,
    ufOrigemCompra,
    ufDestinoCompra,
    ufOrigemVenda,
    ufDestinoVenda,
    modalidadeFreteVenda,
    modalidadeFreteCompra,
    enquadramentoCliente,
    considerarReoneracao2026,
    usarAliquotaReformaPlena,
  ])

  // Resetar valores do formulário para valores padrão
  const handleResetarFormulario = () => {
    const cap = deduzirCapacidadeEmbalagem(
      produtoSelecionado?.embalagem,
      produtoSelecionado?.descricao,
    )
    const embPadrao = cap > 0 ? Math.max(1, Math.ceil(1000 / cap)) : 50
    setVolumePorEmbalagem(cap)
    setQtdEmbalagens(embPadrao)
    setQuantidade(Number((embPadrao * cap).toFixed(2)))
    setDataCompra(hoje)
    setPrazoCompraDias(30)
    setMoedaCompra('BRL')
    setTaxaDolarCompra(5.75)
    setModalidadeFreteCompra('FOB')
    setUfOrigemCompra('SP')
    setUfDestinoCompra('SP')
    setAlertaRegraCompra(null)
    setFreteCompra(1200)
    setSeguroCompra(200)
    setOutrasDespesasCompra(100)
    setTaxaJurosCompraMensal(1.2)
    setDataVenda(hoje)
    setPrazoVendaDias(60)
    setMoedaVenda('BRL')
    setTaxaDolarVenda(5.75)
    setModalidadeFreteVenda('CIF')
    setFreteVenda(2500)
    setSeguroVenda(350)
    setOutrasDespesasVenda(150)
    setComissaoVendaPerc(2.5)
    setTaxaJurosVendaMensal(1.8)
    setMargemAlvoPerc(15)
    setEnquadramentoCliente('produtor_rural')
    if (produtoSelecionado?.preco_base_sugerido) {
      setPrecoUnitarioCompra(produtoSelecionado.preco_base_sugerido)
      setPrecoUnitarioVenda(Number((produtoSelecionado.preco_base_sugerido * 1.35).toFixed(2)))
    }
    toast({
      title: 'Valores redefinidos',
      description: 'Variáveis das operações de compra e venda voltaram ao padrão.',
    })
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-16 animate-in fade-in duration-200">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DCE5DC] pb-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#1B5E20] text-white shadow-sm ring-1 ring-emerald-900/10">
                <Calculator className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-[#1C2B1C]">
                    Simulador Comercial Agro
                  </h1>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-xs">
                    Compra & Venda Segregadas
                  </Badge>
                </div>
                <p className="text-sm text-[#5A6D5A]">
                  Simulação segregada da operação de aquisição (compra) e revenda (venda), com
                  datas, vencimento, juros de prazo, tributos interestaduais e resultado da
                  operação.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={carregarProdutos}
              disabled={carregandoProdutos}
              className="border-[#DCE5DC] text-[#1C2B1C] hover:bg-emerald-50 h-9"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 text-[#1B5E20] ${carregandoProdutos ? 'animate-spin' : ''}`}
              />
              Atualizar Base
            </Button>
            <Button
              onClick={handleSimular}
              disabled={calculando}
              className="bg-[#1B5E20] hover:bg-[#154a19] text-white shadow-sm font-semibold h-9 px-4"
            >
              <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
              {calculando ? 'Calculando...' : 'Simular Operação'}
            </Button>
          </div>
        </div>

        {/* Navegação por Abas */}
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full space-y-6">
          <TabsList className="bg-[#F5F7F1] border border-[#DCE5DC] p-1 h-auto grid grid-cols-3 max-w-xl rounded-xl">
            <TabsTrigger
              value="simulacao"
              className="flex items-center gap-2 py-2 text-xs font-semibold data-[state=active]:bg-[#1B5E20] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <Calculator className="w-4 h-4" />
              <span>Simulação</span>
            </TabsTrigger>

            <TabsTrigger
              value="produtos"
              className="flex items-center gap-2 py-2 text-xs font-semibold data-[state=active]:bg-[#1B5E20] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <Package className="w-4 h-4" />
              <span>Base de Produtos</span>
            </TabsTrigger>

            <TabsTrigger
              value="regras"
              className="flex items-center gap-2 py-2 text-xs font-semibold data-[state=active]:bg-[#1B5E20] data-[state=active]:text-white data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <Layers className="w-4 h-4" />
              <span>Regras Fiscais</span>
            </TabsTrigger>
          </TabsList>

          {/* =================================================================== */}
          {/* ABA 1: SIMULAÇÃO COM COMPRA E VENDA SEGREGADAS                     */}
          {/* =================================================================== */}
          <TabsContent value="simulacao" className="mt-0 space-y-6">
            <Card className="border-[#DCE5DC] shadow-sm bg-white overflow-hidden">
              <CardHeader className="bg-[#F8FAF6] border-b border-[#DCE5DC] py-4 px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-[#1B5E20]">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-[#1C2B1C]">
                        Parâmetros da Operação Comercial Segregada
                      </CardTitle>
                      <CardDescription className="text-xs text-[#5A6D5A]">
                        Configure o insumo, volume do lote e os dois blocos distintos (Operação de
                        Compra e Operação de Venda) para apurar o resultado real.
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetarFormulario}
                      className="text-xs text-[#5A6D5A] hover:text-[#1C2B1C] hover:bg-[#F0F4EC] h-8 px-2.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      Redefinir
                    </Button>
                    <Badge
                      variant="outline"
                      className="text-[11px] font-mono bg-white text-[#1B5E20] border-emerald-300"
                    >
                      53 Linhas Excel
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* ----------------------------------------------------------- */}
                {/* SEÇÃO 1: PRODUTO BASE & VOLUME DO LOTE                      */}
                {/* ----------------------------------------------------------- */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#1B5E20] text-white text-xs font-bold flex items-center justify-center">
                        1
                      </div>
                      <h2 className="text-sm font-bold text-[#1C2B1C] uppercase tracking-wide">
                        Insumo Agropecuário & Volume do Lote
                      </h2>
                    </div>
                    <span className="text-[11px] text-[#5A6D5A]">
                      {produtos.length > 0 ? `${produtos.length} produtos na base` : 'Base local'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {/* Busca de Produtos */}
                    <div className="lg:col-span-7 space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <Input
                          placeholder="Buscar por descrição, NCM, código Protheus ou princípio ativo..."
                          value={termoBuscaProduto}
                          onChange={(e) => setTermoBuscaProduto(e.target.value)}
                          className="pl-9 text-xs h-9 border-[#DCE5DC] focus-visible:ring-[#1B5E20] bg-[#FCFDFB]"
                        />
                        {termoBuscaProduto && (
                          <button
                            type="button"
                            onClick={() => setTermoBuscaProduto('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="max-h-44 overflow-y-auto border border-[#DCE5DC] rounded-lg divide-y divide-gray-100 bg-white shadow-inner">
                        {produtosDisponiveis.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-500">
                            Nenhum produto encontrado para "{termoBuscaProduto}".
                          </div>
                        ) : (
                          produtosDisponiveis.map((p, idx) => {
                            const isSelected =
                              produtoSelecionado?.codigo === p.codigo &&
                              produtoSelecionado?.descricao === p.descricao
                            return (
                              <button
                                key={p.id || p.codigo || idx}
                                type="button"
                                onClick={() => selecionarProduto(p)}
                                className={`w-full text-left p-2.5 transition-all flex items-start justify-between gap-3 text-xs ${
                                  isSelected
                                    ? 'bg-emerald-50 border-l-4 border-l-[#1B5E20] text-[#0D2811]'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold truncate leading-tight text-gray-900">
                                    {p.descricao}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500 mt-1">
                                    {p.codigo && (
                                      <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-medium">
                                        Cód: {p.codigo}
                                      </span>
                                    )}
                                    <span className="font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                                      NCM {p.ncm || 'S/NCM'}
                                    </span>
                                    <span>•</span>
                                    <span>Origem: {p.origem || 'Nac'}</span>
                                    {p.gr_trib && (
                                      <span className="bg-blue-50 text-blue-700 px-1 rounded font-mono">
                                        GrTrib {p.gr_trib}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="flex items-center gap-1 text-[#1B5E20] shrink-0 font-medium text-[11px] mt-0.5">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="hidden sm:inline">Selecionado</span>
                                  </div>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    {/* Card do Produto Selecionado */}
                    <div className="lg:col-span-5">
                      {produtoSelecionado ? (
                        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/90 via-emerald-50/50 to-white border border-emerald-200/80 shadow-xs space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">
                                Produto Selecionado
                              </span>
                              <h3 className="font-bold text-xs text-[#0D2811] line-clamp-2 mt-0.5">
                                {produtoSelecionado.descricao}
                              </h3>
                            </div>
                            <Badge className="bg-[#1B5E20] text-white text-[10px] shrink-0">
                              {produtoSelecionado.unidade || 'L'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/50">
                            <div>
                              <span className="text-gray-500 block text-[10px]">NCM:</span>
                              <span className="font-mono font-semibold text-gray-800">
                                {produtoSelecionado.ncm || '3808.93.29'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[10px]">GrTrib:</span>
                              <span className="font-mono font-semibold text-gray-800">
                                {produtoSelecionado.gr_trib || '001'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[10px]">Embalagem:</span>
                              <span className="font-medium text-gray-800 truncate block">
                                {produtoSelecionado.embalagem || 'Padrão'}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[10px]">Origem:</span>
                              <span className="font-medium text-gray-800 truncate block">
                                {produtoSelecionado.origem || 'Nacional'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 border border-dashed border-[#DCE5DC] rounded-xl text-center text-xs text-gray-500">
                          Selecione um produto na lista ao lado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Volume e Embalagens do Lote */}
                  <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-emerald-950 flex items-center justify-between">
                        <span>Volume Total do Lote</span>
                        <span className="text-[10px] font-bold text-emerald-700">
                          {produtoSelecionado?.unidade || 'L'}
                        </span>
                      </Label>
                      <InputValor2Casas
                        min={0.01}
                        value={quantidade}
                        onValueChange={(val) => handleAlterarVolume(Math.max(0.01, val))}
                        className="text-xs h-9 bg-white border-emerald-200 font-bold text-gray-900"
                      />
                      <span className="text-[10px] text-gray-500 block">
                        Volume total negociado ({formatarValor2Casas(quantidade)}{' '}
                        {produtoSelecionado?.unidade || 'L'})
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-emerald-950 flex items-center justify-between">
                        <span>Capacidade por Embalagem</span>
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 bg-emerald-100/80 text-emerald-800 border-emerald-300"
                        >
                          Auto • Múltiplo ({produtoSelecionado?.unidade || 'L'}/emb.)
                        </Badge>
                      </Label>
                      <Input
                        type="text"
                        value={formatarValor2Casas(volumePorEmbalagem)}
                        readOnly
                        disabled
                        title="Definido automaticamente de acordo com o múltiplo da embalagem no cadastro do produto"
                        className="text-xs h-9 bg-gray-100/90 border-emerald-200/80 font-bold text-gray-800 cursor-not-allowed opacity-100"
                      />
                      <span className="text-[10px] text-emerald-800 font-medium block truncate">
                        Múltiplo do cadastro: {produtoSelecionado?.embalagem || 'Padrão'} (
                        {formatarValor2Casas(volumePorEmbalagem)}{' '}
                        {produtoSelecionado?.unidade || 'L'})
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-emerald-950 flex items-center justify-between">
                        <span>Qtd. Embalagens Físicas</span>
                        <span className="text-[10px] font-bold text-emerald-700">unidades</span>
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={qtdEmbalagens}
                        onChange={(e) =>
                          handleAlterarQtdEmbalagens(Math.max(1, Number(e.target.value)))
                        }
                        className="text-xs h-9 bg-white border-emerald-200 font-bold text-gray-900"
                      />
                      <span className="text-[10px] text-gray-500 block">
                        = {qtdEmbalagens} × {formatarValor2Casas(volumePorEmbalagem)}{' '}
                        {produtoSelecionado?.unidade || 'L'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#DCE5DC]" />

                {/* ----------------------------------------------------------- */}
                {/* SEÇÃO 2: OPERAÇÃO DE COMPRA (AQUISIÇÃO)                     */}
                {/* ----------------------------------------------------------- */}
                <div className="p-4 rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50/40 via-white to-sky-50/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-sky-700 text-white text-xs font-bold flex items-center justify-center">
                        2
                      </div>
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-sky-700" />
                        <h2 className="text-sm font-bold text-sky-950 uppercase tracking-wide">
                          Operação de Compra (Aquisição do Produto)
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="bg-sky-100 text-sky-900 border-sky-300 font-mono">
                        Vencimento: {vencimentoCompraCalculado} ({prazoCompraDias} dias)
                      </Badge>
                      <Badge className="bg-sky-50 text-sky-800 border-sky-200 font-mono">
                        Juros: {formatarValor2Casas(jurosCompraEfetivoPerc)}% efetivo
                      </Badge>
                    </div>
                  </div>

                  {/* Campos da Compra - Linha 1 (Prazos, Moeda, Taxa Dólar, Preço e Juros) */}
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 ${
                      moedaCompra === 'USD' ? 'md:grid-cols-6' : 'md:grid-cols-5'
                    } gap-3 text-xs`}
                  >
                    {/* Data da Compra */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-700" />
                        Data da Compra
                      </Label>
                      <Input
                        type="date"
                        value={dataCompra}
                        onChange={(e) => setDataCompra(e.target.value)}
                        className="h-8 text-xs border-sky-200 bg-white"
                      />
                    </div>

                    {/* Prazo de Pagamento (dias) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-sky-700" />
                          Prazo Compra (dias)
                        </span>
                        <span className="text-[10px] text-gray-500">Dias corridos</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={prazoCompraDias}
                        onChange={(e) => setPrazoCompraDias(Math.max(0, Number(e.target.value)))}
                        className="h-8 text-xs font-semibold border-sky-200 bg-white"
                      />
                    </div>

                    {/* Moeda da Operação de Compra (Reais ou Dólar) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-sky-700" />
                        Moeda da Compra
                      </Label>
                      <select
                        value={moedaCompra}
                        onChange={(e) => setMoedaCompra(e.target.value as 'BRL' | 'USD')}
                        className="w-full h-8 text-xs rounded-md border border-sky-200 bg-white px-2 font-bold text-sky-950"
                      >
                        <option value="BRL">Reais (R$ - BRL)</option>
                        <option value="USD">Dólar (US$ - USD)</option>
                      </select>
                    </div>

                    {/* Taxa do Dólar na Compra (habilitado quando escolher Dólar) */}
                    {moedaCompra === 'USD' && (
                      <div className="space-y-1 animate-in fade-in duration-150">
                        <Label className="text-xs font-semibold text-amber-900 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                            Taxa do Dólar (R$)
                          </span>
                          <span className="text-[10px] font-mono text-amber-800">US$ 1,00</span>
                        </Label>
                        <InputValor2Casas
                          min={0.01}
                          value={taxaDolarCompra}
                          onValueChange={(val) => setTaxaDolarCompra(Math.max(0.01, val))}
                          className="h-8 text-xs font-mono font-bold border-amber-300 bg-amber-50/60 text-amber-950"
                        />
                      </div>
                    )}

                    {/* Preço Unitário de Compra */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span>Preço de Compra ({moedaCompra === 'USD' ? 'US$' : 'R$'})</span>
                        <Badge variant="outline" className="text-[10px] py-0 h-4 border-sky-300">
                          {moedaCompra}
                        </Badge>
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={precoUnitarioCompra}
                        onValueChange={(val) => setPrecoUnitarioCompra(val)}
                        className="h-8 text-xs font-bold border-sky-200 bg-white"
                      />
                      {moedaCompra === 'USD' && (
                        <p className="text-[10px] font-mono text-sky-800 font-semibold">
                          = R$ {formatarValor2Casas(precoUnitarioCompra * (taxaDolarCompra || 0))} /{' '}
                          {produtoSelecionado?.unidade || 'unid'}
                        </p>
                      )}
                    </div>

                    {/* Taxa de Juros de Compra (% a.m.) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Landmark className="w-3.5 h-3.5 text-sky-700" />
                          Juros Compra (% a.m.)
                        </span>
                        <span className="text-[10px] text-sky-700 font-bold">
                          {formatarValor2Casas(jurosCompraEfetivoPerc)}% no prazo
                        </span>
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={taxaJurosCompraMensal}
                        onValueChange={(val) => setTaxaJurosCompraMensal(val)}
                        className="h-8 text-xs border-sky-200 bg-white"
                      />
                    </div>
                  </div>

                  {/* Campos da Compra - Linha 2 (Logística, Rota Fiscal e ICMS) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs pt-1">
                    {/* Modalidade Frete Compra */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-sky-700" />
                        Frete de Compra
                      </Label>
                      <select
                        value={modalidadeFreteCompra}
                        onChange={(e) =>
                          setModalidadeFreteCompra(e.target.value as ModalidadeFrete)
                        }
                        className="w-full h-8 text-xs rounded-md border border-sky-200 bg-white px-2 font-medium"
                      >
                        <option value="FOB">FOB (Adiciona no Custo da Compra)</option>
                        <option value="CIF">CIF (Já Incluso no Preço do Fornecedor)</option>
                      </select>
                    </div>

                    {/* Valor do Frete Compra */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800">
                        Valor do Frete (R$)
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={freteCompra}
                        onValueChange={(val) => setFreteCompra(val)}
                        className="h-8 text-xs border-sky-200 bg-white"
                      />
                    </div>

                    {/* Seguro & Outras Despesas Compra */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800">
                        Seguro & Outros (R$)
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <InputValor2Casas
                          min={0}
                          value={seguroCompra}
                          onValueChange={(val) => setSeguroCompra(val)}
                          placeholder="Seguro"
                          className="h-8 text-xs border-sky-200 bg-white"
                        />
                        <InputValor2Casas
                          min={0}
                          value={outrasDespesasCompra}
                          onValueChange={(val) => setOutrasDespesasCompra(val)}
                          placeholder="Outros"
                          className="h-8 text-xs border-sky-200 bg-white"
                        />
                      </div>
                    </div>

                    {/* Rota Fiscal de Compra: UF Origem e UF Destino */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-sky-700" />
                          UF Origem → Destino
                        </span>
                        <span className="text-[10px] text-sky-700 font-mono">
                          {ufOrigemCompra} → {ufDestinoCompra}
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={ufOrigemCompra}
                          onChange={(e) => setUfOrigemCompra(e.target.value)}
                          className="h-8 text-xs rounded-md border border-sky-200 bg-white px-2 font-medium"
                          title="UF Origem (da aquisição/fornecedor)"
                        >
                          {UFS_BRASIL.map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                        <select
                          value={ufDestinoCompra}
                          onChange={(e) => setUfDestinoCompra(e.target.value)}
                          className="h-8 text-xs rounded-md border border-sky-200 bg-white px-2 font-medium"
                          title="UF Destino (onde o comprador está)"
                        >
                          {UFS_BRASIL.map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Crédito ICMS de Entrada / Carga Tributária da Compra (Bloqueado/Automático) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span title="Carga Tributária ICMS de Entrada (Regra Fiscal)">
                          Crédito ICMS Entrada (%)
                        </span>
                        <span className="text-[10px] text-sky-700 font-bold">
                          {regraIcmsCompraAtual ? 'Regra Fiscal' : 'Sem regra'}
                        </span>
                      </Label>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={
                            regraIcmsCompraAtual
                              ? `${formatarValor2Casas(aliquotaIcmsCreditoCompra)}%`
                              : '0,00%'
                          }
                          aria-readonly="true"
                          title="Preenchido automaticamente pela Regra Fiscal (bloqueado para edição)"
                          className={`w-full h-8 text-xs rounded-md border px-2.5 font-bold cursor-not-allowed select-none opacity-90 shadow-inner ${
                            alertaRegraCompra
                              ? 'border-amber-300 bg-amber-50/70 text-amber-950'
                              : 'border-sky-200 bg-sky-50/70 text-sky-950'
                          }`}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sky-700 bg-sky-100/80 px-1 rounded font-mono font-semibold pointer-events-none">
                          Auto
                        </span>
                      </div>
                      <p className="text-[10px] text-sky-700 leading-tight">
                        Alíquota definida exclusivamente pela Regra Fiscal correspondente.
                      </p>
                    </div>
                  </div>

                  {/* Aviso visível de Regra Fiscal de Compra */}
                  {alertaRegraCompra ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold">
                          Regra de ICMS de compra não encontrada:{' '}
                        </span>
                        <span>{alertaRegraCompra}</span>{' '}
                        <span className="text-[11px] text-amber-800">
                          (Cadastre a regra fiscal correspondente na aba Regras Fiscais).
                        </span>
                      </div>
                    </div>
                  ) : regraIcmsCompraAtual ? (
                    <div className="flex items-center justify-between p-2 rounded-lg border border-sky-200 bg-sky-50/70 text-sky-950 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                        <span>
                          <strong>Regra Fiscal Aplicada:</strong> {ufOrigemCompra} →{' '}
                          {ufDestinoCompra}
                          {regraIcmsCompraAtual.grupo_tributario_codigo
                            ? ` (GrTrib: ${regraIcmsCompraAtual.grupo_tributario_codigo})`
                            : ' (Geral)'}
                          {' — '}Alíquota Nominal:{' '}
                          {formatarValor2Casas(regraIcmsCompraAtual.aliquota_icms)}%
                          {regraIcmsCompraAtual.reducao_base !== undefined &&
                          regraIcmsCompraAtual.reducao_base !== null
                            ? ` | Redução: ${formatarValor2Casas(regraIcmsCompraAtual.reducao_base)}%`
                            : ''}
                          {regraIcmsCompraAtual.aliquota_efetiva !== undefined &&
                          regraIcmsCompraAtual.aliquota_efetiva !== null
                            ? ` | Alíquota Efetiva: ${formatarValor2Casas(regraIcmsCompraAtual.aliquota_efetiva)}%`
                            : ''}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-sky-300 text-sky-800 bg-white"
                      >
                        ICMS Carga{' '}
                        {formatarValor2Casas(
                          regraIcmsCompraAtual.aliquota_efetiva ??
                            regraIcmsCompraAtual.aliquota_icms,
                        )}
                        %
                      </Badge>
                    </div>
                  ) : null}
                </div>

                {/* ----------------------------------------------------------- */}
                {/* SEÇÃO 3: OPERAÇÃO DE VENDA (REVENDA)                        */}
                {/* ----------------------------------------------------------- */}
                <div className="p-4 rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-50/40 via-white to-emerald-50/20 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#1B5E20] text-white text-xs font-bold flex items-center justify-center">
                        3
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-[#1B5E20]" />
                        <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                          Operação de Venda (Revenda Comercial ao Cliente)
                        </h2>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-mono">
                        Vencimento: {vencimentoVendaCalculado} ({prazoVendaDias} dias)
                      </Badge>
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-mono">
                        Juros: {formatarValor2Casas(jurosVendaEfetivoPerc)}% efetivo
                      </Badge>
                    </div>
                  </div>

                  {/* Campos da Venda - Linha 1 (Prazos, Moeda, Taxa Dólar, Preço e Juros) */}
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 ${
                      moedaVenda === 'USD' ? 'md:grid-cols-6' : 'md:grid-cols-5'
                    } gap-3 text-xs`}
                  >
                    {/* Data da Venda */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#1B5E20]" />
                        Data da Venda
                      </Label>
                      <Input
                        type="date"
                        value={dataVenda}
                        onChange={(e) => setDataVenda(e.target.value)}
                        className="h-8 text-xs border-emerald-200 bg-white"
                      />
                    </div>

                    {/* Prazo de Pagamento Concedido ao Cliente (dias) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#1B5E20]" />
                          Prazo Venda (dias)
                        </span>
                        <span className="text-[10px] text-gray-500">Concedido</span>
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={prazoVendaDias}
                        onChange={(e) => setPrazoVendaDias(Math.max(0, Number(e.target.value)))}
                        className="h-8 text-xs font-semibold border-emerald-200 bg-white"
                      />
                    </div>

                    {/* Moeda da Operação de Venda (Reais ou Dólar) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-[#1B5E20]" />
                        Moeda da Venda
                      </Label>
                      <select
                        value={moedaVenda}
                        onChange={(e) => setMoedaVenda(e.target.value as 'BRL' | 'USD')}
                        className="w-full h-8 text-xs rounded-md border border-emerald-200 bg-white px-2 font-bold text-emerald-950"
                      >
                        <option value="BRL">Reais (R$ - BRL)</option>
                        <option value="USD">Dólar (US$ - USD)</option>
                      </select>
                    </div>

                    {/* Taxa do Dólar na Venda (habilitado quando escolher Dólar) */}
                    {moedaVenda === 'USD' && (
                      <div className="space-y-1 animate-in fade-in duration-150">
                        <Label className="text-xs font-semibold text-amber-900 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-amber-700" />
                            Taxa do Dólar (R$)
                          </span>
                          <span className="text-[10px] font-mono text-amber-800">US$ 1,00</span>
                        </Label>
                        <InputValor2Casas
                          min={0.01}
                          value={taxaDolarVenda}
                          onValueChange={(val) => setTaxaDolarVenda(Math.max(0.01, val))}
                          className="h-8 text-xs font-mono font-bold border-amber-300 bg-amber-50/60 text-amber-950"
                        />
                      </div>
                    )}

                    {/* Preço Unitário de Venda */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span>Preço de Venda ({moedaVenda === 'USD' ? 'US$' : 'R$'})</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-4 border-emerald-300"
                        >
                          {moedaVenda}
                        </Badge>
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={precoUnitarioVenda}
                        onValueChange={(val) => setPrecoUnitarioVenda(val)}
                        className="h-8 text-xs font-bold border-emerald-200 bg-white"
                      />
                      <div className="flex items-center justify-between gap-1 pt-0.5">
                        {moedaVenda === 'USD' ? (
                          <span className="text-[10px] font-mono text-emerald-800 font-semibold">
                            = R$ {formatarValor2Casas(precoUnitarioVenda * (taxaDolarVenda || 0))} /{' '}
                            {produtoSelecionado?.unidade || 'unid'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-gray-500">
                            Sugerido ({formatarValor2Casas(margemAlvoPerc)}%): R${' '}
                            {formatarValor2Casas(sugestaoPrecoVenda.unitarioMoedaVenda)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setPrecoUnitarioVenda(
                              Number(sugestaoPrecoVenda.unitarioMoedaVenda.toFixed(2)),
                            )
                          }
                          className="text-[10px] font-bold text-[#1B5E20] hover:underline shrink-0"
                          title="Aplicar preço unitário sugerido pela Margem Alvo"
                        >
                          Usar sugerido
                        </button>
                      </div>
                    </div>

                    {/* Juros da Venda (% a.m.) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Landmark className="w-3.5 h-3.5 text-[#1B5E20]" />
                          Juros Venda (% a.m.)
                        </span>
                        <span className="text-[10px] text-[#1B5E20] font-bold">
                          {formatarValor2Casas(jurosVendaEfetivoPerc)}% no prazo
                        </span>
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={taxaJurosVendaMensal}
                        onValueChange={(val) => setTaxaJurosVendaMensal(val)}
                        className="h-8 text-xs border-emerald-200 bg-white"
                      />
                    </div>
                  </div>

                  {/* Campos da Venda - Linha 2 (Rota Fiscal, Cliente, Frete, Despesas, Comissão, Margem, Regime) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">

                    {/* Rota Fiscal: Origem e Destino */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-[#1B5E20]" />
                          UF Origem → Destino
                        </span>
                        <span className="text-[10px] text-[#1B5E20] font-mono">
                          {ufOrigemVenda} → {ufDestinoVenda}
                        </span>
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={ufOrigemVenda}
                            aria-readonly="true"
                            title="Preenchido automaticamente pela UF Destino da compra (bloqueado para edição)"
                            className="w-full h-8 text-xs rounded-md border border-emerald-200 bg-emerald-50/70 text-emerald-950 px-2.5 font-bold cursor-not-allowed select-none opacity-90 shadow-inner"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 bg-emerald-100/80 px-1 rounded font-mono font-semibold pointer-events-none">
                            Auto
                          </span>
                        </div>
                        <select
                          value={ufDestinoVenda}
                          onChange={(e) => setUfDestinoVenda(e.target.value)}
                          className="h-8 text-xs rounded-md border border-emerald-200 bg-white px-2 font-medium"
                          title="UF Destino da venda ao cliente"
                        >
                          {UFS_BRASIL.map((uf) => (
                            <option key={uf} value={uf}>
                              {uf}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[10px] text-[#5A6D5A] leading-tight">
                        Origem vinculada à UF Destino da compra ({ufDestinoCompra}).
                      </p>
                    </div>

                    {/* Enquadramento do Cliente */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800">
                        Enquadramento Cliente
                      </Label>
                      <select
                        value={enquadramentoCliente}
                        onChange={(e) =>
                          setEnquadramentoCliente(e.target.value as EnquadramentoCliente)
                        }
                        className="w-full h-8 text-xs rounded-md border border-emerald-200 bg-white px-2 font-medium"
                      >
                        <option value="produtor_rural">Produtor Rural (PF/PJ)</option>
                        <option value="revenda">Revenda / Distribuidor</option>
                        <option value="cooperativa">Cooperativa Agropecuária</option>
                        <option value="consumidor_final">Consumidor Final</option>
                      </select>
                    </div>

                    {/* Modalidade Frete Venda */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-[#1B5E20]" />
                        Modalidade Frete Venda
                      </Label>
                      <select
                        value={modalidadeFreteVenda}
                        onChange={(e) => setModalidadeFreteVenda(e.target.value as ModalidadeFrete)}
                        className="w-full h-8 text-xs rounded-md border border-emerald-200 bg-white px-2 font-bold"
                      >
                        <option value="CIF">CIF (Emitente / entra na base ICMS)</option>
                        <option value="FOB">FOB (Cliente / fora da base ICMS)</option>
                      </select>
                    </div>

                    {/* Frete de Venda (R$) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800">
                        Frete de Venda (R$)
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={freteVenda}
                        onValueChange={(val) => setFreteVenda(val)}
                        className="h-8 text-xs border-emerald-200 bg-white font-semibold"
                      />
                    </div>

                    {/* Seguro & Outros Venda */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800">
                        Seguro & Outros Venda (R$)
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <InputValor2Casas
                          min={0}
                          value={seguroVenda}
                          onValueChange={(val) => setSeguroVenda(val)}
                          placeholder="Seguro"
                          className="h-8 text-xs border-emerald-200 bg-white"
                        />
                        <InputValor2Casas
                          min={0}
                          value={outrasDespesasVenda}
                          onValueChange={(val) => setOutrasDespesasVenda(val)}
                          placeholder="Outros"
                          className="h-8 text-xs border-emerald-200 bg-white"
                        />
                      </div>
                    </div>

                    {/* Comissão de Vendas (%) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span>Comissão Vendas (%)</span>
                        <span className="text-[10px] text-gray-500">s/ faturamento</span>
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={comissaoVendaPerc}
                        onValueChange={(val) => setComissaoVendaPerc(val)}
                        className="h-8 text-xs border-emerald-200 bg-white"
                      />
                    </div>

                    {/* Margem Alvo Desejada (%) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                        <span>Margem Alvo (%)</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          Define preço sugerido
                        </span>
                      </Label>
                      <InputValor2Casas
                        min={0}
                        value={margemAlvoPerc}
                        onValueChange={(val) => setMargemAlvoPerc(val)}
                        className="h-8 text-xs font-bold border-emerald-300 bg-white"
                      />
                    </div>

                    {/* Regime PIS/COFINS & Reforma */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-gray-800">
                        Regime Tributário Saída
                      </Label>
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setConsiderarReoneracao2026(!considerarReoneracao2026)}
                          className="h-8 text-[11px] flex-1 px-1 bg-white border-emerald-200"
                        >
                          {considerarReoneracao2026 ? 'LC 224 (0,92%)' : 'Lei 10.925 (0,00%)'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUsarAliquotaReformaPlena(!usarAliquotaReformaPlena)}
                          className="h-8 text-[11px] flex-1 px-1 bg-white border-purple-200 text-purple-900"
                        >
                          {usarAliquotaReformaPlena ? 'IBS Pleno' : 'IBS Teste 2026'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Painel de Sugestão de Preço Unitário de Venda a partir da Margem Alvo (%) dentro da Operação de Venda */}
                  <div className="p-3 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-100/80 via-emerald-50/90 to-white flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-900 tracking-wider block">
                          Sugestão de Preço Unitário de Venda (Margem Alvo{' '}
                          {formatarValor2Casas(margemAlvoPerc)}%)
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-lg font-mono font-extrabold text-[#1B5E20]">
                            {moedaVenda === 'USD'
                              ? formatarMoeda2Casas(sugestaoPrecoVenda.unitarioMoedaVenda, 'USD')
                              : formatarMoeda2Casas(sugestaoPrecoVenda.unitarioReais, 'BRL')}{' '}
                            <span className="text-xs font-semibold text-emerald-800">
                              / {produtoSelecionado?.unidade || 'unid'}
                            </span>
                          </span>
                          {moedaVenda === 'USD' && (
                            <span className="text-xs font-mono font-semibold text-emerald-800">
                              (= {formatarMoeda2Casas(sugestaoPrecoVenda.unitarioReais, 'BRL')} /{' '}
                              {produtoSelecionado?.unidade || 'unid'})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="h-8 w-px bg-emerald-200 hidden sm:block" />

                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-500 block">
                            Preço Mínimo Unitário (Break-Even 0,00%):
                          </span>
                          <span className="font-mono font-bold text-gray-800">
                            {moedaVenda === 'USD'
                              ? `${formatarMoeda2Casas(sugestaoPrecoVenda.breakEvenUnitarioMoedaVenda, 'USD')} (${formatarMoeda2Casas(sugestaoPrecoVenda.breakEvenUnitarioReais, 'BRL')})`
                              : formatarMoeda2Casas(
                                  sugestaoPrecoVenda.breakEvenUnitarioReais,
                                  'BRL',
                                )}{' '}
                            / {produtoSelecionado?.unidade || 'unid'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500 block">
                            Markup Multiplicador:
                          </span>
                          <span className="font-mono font-bold text-[#1B5E20]">
                            {formatarValor2Casas(sugestaoPrecoVenda.markupMultiplicador)}x
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500 block">
                            Faturamento Sugerido do Lote:
                          </span>
                          <span className="font-mono font-bold text-emerald-950">
                            {formatarMoeda2Casas(sugestaoPrecoVenda.totalReais, 'BRL')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const novoPreco = Number(sugestaoPrecoVenda.unitarioMoedaVenda.toFixed(2))
                        setPrecoUnitarioVenda(novoPreco)
                        toast({
                          title: 'Preço Sugerido Aplicado',
                          description: `Preço unitário de venda atualizado para ${formatarMoeda2Casas(
                            novoPreco,
                            moedaVenda,
                          )} (Margem Alvo ${formatarValor2Casas(margemAlvoPerc)}%).`,
                        })
                      }}
                      className="bg-[#1B5E20] hover:bg-[#154a19] text-white font-bold text-xs h-8 px-3 shrink-0 shadow-xs"
                    >
                      Aplicar Preço Sugerido na Venda
                    </Button>
                  </div>
                </div>

                {/* BOTÃO PRINCIPAL */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#DCE5DC]">
                  <div className="text-xs text-[#5A6D5A]">
                    Simule para apurar a segregação de compra/venda, custos financeiros e o
                    resultado da operação.
                  </div>

                  <Button
                    onClick={handleSimular}
                    disabled={calculando}
                    className="w-full sm:w-auto bg-[#1B5E20] hover:bg-[#154a19] text-white shadow-md font-bold h-10 px-8 text-sm transition-all"
                  >
                    <Sparkles className="w-4 h-4 mr-2 text-amber-300" />
                    {calculando ? 'Calculando...' : 'Simular Operação Completa'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* =============================================================== */}
            {/* PAINEL DE RESULTADOS SEGREGADOS                                */}
            {/* =============================================================== */}
            {resultado ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Alerta caso sem regra de ICMS */}
                {!resultado.temRegraIcms && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 shadow-xs">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-bold">
                        Atenção: Sem regra de ICMS cadastrada para {resultado.ufOrigem} →{' '}
                        {resultado.ufDestino}
                      </p>
                      <p className="text-amber-800 leading-relaxed">
                        O cálculo utilizou a alíquota padrão estimada interestadual de{' '}
                        <strong>{formatarValor2Casas(resultado.icms.aliquotaNominal)}%</strong>.
                        Para máxima precisão fiscal, confira a aba <strong>"Regras Fiscais"</strong>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* ----------------------------------------------------------- */}
                {/* 1. CARTÕES EXECUTIVOS: COMPRA, VENDA E RESULTADO DA OPERAÇÃO*/}
                {/* ----------------------------------------------------------- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Custo Total de Aquisição (COMPRA) */}
                  <Card className="border-sky-200 bg-gradient-to-br from-sky-50/60 to-white shadow-xs">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider flex items-center gap-1">
                          <ShoppingCart className="w-3.5 h-3.5 text-sky-700" />
                          1. Custo da Compra
                        </span>
                        <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px]">
                          Venc. {resultado.compra.dataVencimento}
                        </Badge>
                      </div>
                      <p className="text-xl font-extrabold text-sky-950 tracking-tight">
                        {formatarMoeda2Casas(resultado.compra.custoTotalComJuros, 'BRL')}
                      </p>
                      <div className="text-[11px] text-sky-800 flex items-center justify-between pt-0.5">
                        <span>Mercadoria + Despesas:</span>
                        <span className="font-mono font-semibold">
                          {formatarMoeda2Casas(resultado.compra.custoAquisicaoMercadoria, 'BRL')}
                        </span>
                      </div>
                      <div className="text-[11px] text-sky-700 flex items-center justify-between">
                        <span>Juros ({resultado.compra.prazoDias}d):</span>
                        <span className="font-mono font-semibold">
                          + {formatarMoeda2Casas(resultado.compra.jurosValor, 'BRL')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Faturamento Bruto (VENDA) */}
                  <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white shadow-xs">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                          2. Receita da Venda
                        </span>
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                          Venc. {resultado.venda.dataVencimento}
                        </Badge>
                      </div>
                      <p className="text-xl font-extrabold text-[#1B5E20] tracking-tight">
                        {formatarMoeda2Casas(resultado.venda.faturamentoBrutoTotal, 'BRL')}
                      </p>
                      <div className="text-[11px] text-emerald-800 flex items-center justify-between pt-0.5">
                        <span>Receita Líquida:</span>
                        <span className="font-mono font-semibold">
                          {formatarMoeda2Casas(resultado.venda.receitaLiquida, 'BRL')}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700 flex items-center justify-between">
                        <span>Juros Financiados ({resultado.venda.prazoDias}d):</span>
                        <span className="font-mono font-semibold">
                          + {formatarMoeda2Casas(resultado.venda.jurosValor, 'BRL')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3: Carga Tributária da Venda */}
                  <Card className="border-[#DCE5DC] bg-white shadow-xs">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-[#5A6D5A] uppercase tracking-wider">
                          Tributos da Venda
                        </span>
                        <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold">
                          {formatarValor2Casas(resultado.venda.cargaTributariaEfetivaPerc)}% efetivo
                        </Badge>
                      </div>
                      <p className="text-xl font-extrabold text-red-700 tracking-tight">
                        {formatarMoeda2Casas(resultado.venda.totalTributos, 'BRL')}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        ICMS {formatarMoeda2Casas(resultado.icms.icmsEfetivoRecolher, 'BRL')} +
                        PIS/COFINS + IBS/CBS
                      </p>
                    </CardContent>
                  </Card>

                  {/* Card 4: RESULTADO DA OPERAÇÃO (Destaque Principal) */}
                  <Card className="border-emerald-800 bg-gradient-to-br from-[#0D2811] via-[#154a19] to-[#1B5E20] text-white shadow-md">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                          <CircleDollarSign className="w-3.5 h-3.5" />
                          Resultado da Operação
                        </span>
                        <Badge className="bg-amber-400/20 text-amber-200 text-[10px] border-amber-400/30 font-bold">
                          {formatarValor2Casas(
                            resultado.resultadoOperacao.margemSobreReceitaBrutaPerc,
                          )}
                          % Margem
                        </Badge>
                      </div>
                      <p className="text-2xl font-extrabold text-white tracking-tight">
                        {formatarMoeda2Casas(
                          resultado.resultadoOperacao.resultadoFinalOperacao,
                          'BRL',
                        )}
                      </p>
                      <div className="text-[11px] text-emerald-200 flex items-center justify-between pt-0.5">
                        <span>ROI s/ Compra:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {formatarValor2Casas(
                            resultado.resultadoOperacao.margemSobreCustoInvestidoPerc,
                          )}
                          %
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-300 flex items-center justify-between">
                        <span>Unitário:</span>
                        <span className="font-mono font-semibold">
                          {formatarMoeda2Casas(
                            resultado.resultadoOperacao.resultadoFinalUnitario,
                            'BRL',
                          )}{' '}
                          / {resultado.unidade}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* 2. QUADRO SEGREGADO LADO A LADO: COMPRA vs VENDA            */}
                {/* ----------------------------------------------------------- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Bloco 1: Detalhes da Compra */}
                  <Card className="border-sky-200 bg-white shadow-xs">
                    <CardHeader className="bg-sky-50/60 border-b border-sky-100 py-3 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-sky-800" />
                          <CardTitle className="text-xs font-bold text-sky-950 uppercase">
                            Detalhamento da Operação de Compra
                          </CardTitle>
                        </div>
                        <Badge className="bg-sky-100 text-sky-900 border-sky-300 text-[10px] font-mono">
                          {resultado.compra.prazoDias} dias
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Rota Fiscal Compra:</span>
                        <span className="font-mono font-semibold text-sky-950">
                          {resultado.compra.ufOrigem} → {resultado.compra.ufDestino}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Data da Compra:</span>
                        <span className="font-mono font-medium">
                          {resultado.compra.dataOperacao}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 font-semibold text-sky-950">
                        <span>Data de Vencimento (Prazo):</span>
                        <span className="font-mono">{resultado.compra.dataVencimento}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Moeda da Operação (Compra):</span>
                        <span className="font-mono font-semibold text-sky-950">
                          {resultado.compra.moedaOriginal === 'USD'
                            ? `Dólar (USD) — Taxa R$ ${formatarValor2Casas(resultado.compra.ptaxAplicada)}`
                            : 'Reais (BRL)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Preço de Aquisição Unitário:</span>
                        <span className="font-mono font-semibold">
                          {resultado.compra.moedaOriginal === 'USD'
                            ? `US$ ${formatarValor2Casas(resultado.compra.precoUnitarioOriginal)} (`
                            : ''}
                          {formatarMoeda2Casas(resultado.compra.precoUnitarioReais, 'BRL')}
                          {resultado.compra.moedaOriginal === 'USD' ? ')' : ''} /{' '}
                          {resultado.unidade}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Valor Mercadoria Total:</span>
                        <span className="font-mono font-semibold">
                          {formatarMoeda2Casas(resultado.compra.valorMercadoriaReais, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 text-emerald-800 bg-emerald-50/40 px-1 rounded">
                        <span className="flex items-center gap-1">
                          Crédito ICMS Entrada (
                          {formatarValor2Casas(resultado.compra.icmsCreditoAliquota)}%):
                          {resultado.compra.temRegraIcms ? (
                            <Badge
                              variant="outline"
                              className="text-[9px] py-0 h-3.5 border-emerald-300 text-emerald-800"
                            >
                              Regra
                            </Badge>
                          ) : null}
                        </span>
                        <span className="font-mono font-semibold">
                          {formatarMoeda2Casas(resultado.compra.icmsCreditoValor, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">
                          Despesas Logísticas (Frete {resultado.compra.modalidadeFrete} + Seg.):
                        </span>
                        <span className="font-mono">
                          {formatarMoeda2Casas(resultado.compra.totalDespesasAcessorias, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 bg-sky-50/40 px-1 rounded font-bold text-sky-950">
                        <span>(=) Custo de Aquisição Mercadoria:</span>
                        <span className="font-mono">
                          {formatarMoeda2Casas(resultado.compra.custoAquisicaoMercadoria, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 text-sky-800">
                        <span>
                          (+) Custo Financeiro / Juros (
                          {formatarValor2Casas(resultado.compra.taxaJurosEfetivaPerc)}% em{' '}
                          {resultado.compra.prazoDias}d):
                        </span>
                        <span className="font-mono font-semibold">
                          + {formatarMoeda2Casas(resultado.compra.jurosValor, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 font-bold bg-sky-100 text-sky-950 px-2 rounded">
                        <span>CUSTO TOTAL DE AQUISIÇÃO (C/ JUROS):</span>
                        <span className="font-mono">
                          {formatarMoeda2Casas(resultado.compra.custoTotalComJuros, 'BRL')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Bloco 2: Detalhes da Venda */}
                  <Card className="border-emerald-300 bg-white shadow-xs">
                    <CardHeader className="bg-emerald-50/60 border-b border-emerald-100 py-3 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[#1B5E20]" />
                          <CardTitle className="text-xs font-bold text-emerald-950 uppercase">
                            Detalhamento da Operação de Venda
                          </CardTitle>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-mono">
                          {resultado.venda.prazoDias} dias
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Data da Venda:</span>
                        <span className="font-mono font-medium">
                          {resultado.venda.dataOperacao}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 font-semibold text-emerald-950">
                        <span>Data de Vencimento Concedido:</span>
                        <span className="font-mono">{resultado.venda.dataVencimento}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Moeda da Operação (Venda):</span>
                        <span className="font-mono font-semibold text-emerald-950">
                          {resultado.venda.moedaOriginal === 'USD'
                            ? `Dólar (USD) — Taxa R$ ${formatarValor2Casas(resultado.venda.ptaxAplicada)}`
                            : 'Reais (BRL)'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Preço de Venda Unitário:</span>
                        <span className="font-mono font-semibold">
                          {resultado.venda.moedaOriginal === 'USD'
                            ? `US$ ${formatarValor2Casas(resultado.venda.precoUnitarioOriginal)} (`
                            : ''}
                          {formatarMoeda2Casas(resultado.venda.precoUnitarioReais, 'BRL')}
                          {resultado.venda.moedaOriginal === 'USD' ? ')' : ''} /{' '}
                          {resultado.unidade}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 font-semibold text-emerald-950">
                        <span>Faturamento Bruto Total:</span>
                        <span className="font-mono">
                          {formatarMoeda2Casas(resultado.venda.faturamentoBrutoTotal, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 text-red-600">
                        <span>(-) Total Tributos da Venda:</span>
                        <span className="font-mono">
                          - {formatarMoeda2Casas(resultado.venda.totalTributos, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 bg-emerald-50/40 px-1 rounded font-bold text-emerald-950">
                        <span>(=) Receita Líquida da Venda:</span>
                        <span className="font-mono">
                          {formatarMoeda2Casas(resultado.venda.receitaLiquida, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-gray-100 text-[#1B5E20]">
                        <span>
                          (+) Juros Financiamento Cliente (
                          {formatarValor2Casas(resultado.venda.taxaJurosEfetivaPerc)}% em{' '}
                          {resultado.venda.prazoDias}d):
                        </span>
                        <span className="font-mono font-semibold">
                          + {formatarMoeda2Casas(resultado.venda.jurosValor, 'BRL')}
                        </span>
                      </div>
                      <div className="flex justify-between py-1.5 font-bold bg-emerald-100 text-emerald-950 px-2 rounded">
                        <span>RECEITA LÍQUIDA + JUROS DE VENDA:</span>
                        <span className="font-mono">
                          {formatarMoeda2Casas(
                            resultado.venda.receitaLiquida + resultado.venda.jurosValor,
                            'BRL',
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ----------------------------------------------------------- */}
                {/* 3. QUADRO RESUMO: RESULTADO FINANCEIRO & RESULTADO OPERAÇÃO */}
                {/* ----------------------------------------------------------- */}
                <Card className="border-emerald-700 bg-white shadow-sm overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-emerald-900 via-[#1B5E20] to-[#154a19] text-white py-3 px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-emerald-200" />
                        <CardTitle className="text-sm font-bold text-white uppercase">
                          3. Consolidação do Resultado da Operação (Venda − Compra)
                        </CardTitle>
                      </div>
                      <Badge className="bg-amber-400 text-amber-950 font-bold text-xs">
                        Resultado Líquido:{' '}
                        {formatarMoeda2Casas(
                          resultado.resultadoOperacao.resultadoFinalOperacao,
                          'BRL',
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Bloco Operacional */}
                      <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-1.5 text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-500 block">
                          Resultado Operacional Bruto
                        </span>
                        <div className="flex justify-between py-1 border-b border-gray-200">
                          <span className="text-gray-600">Receita Líquida:</span>
                          <span className="font-mono font-medium">
                            {formatarMoeda2Casas(resultado.venda.receitaLiquida, 'BRL')}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                          <span>(-) Custo da Mercadoria:</span>
                          <span className="font-mono">
                            -{' '}
                            {formatarMoeda2Casas(resultado.compra.custoAquisicaoMercadoria, 'BRL')}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-200 text-red-600">
                          <span>(-) Despesas Venda (Frete/Com.):</span>
                          <span className="font-mono">
                            -{' '}
                            {formatarMoeda2Casas(
                              resultado.resultadoOperacao.despesasOperacionaisVenda,
                              'BRL',
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 font-bold text-gray-900">
                          <span>(=) Margem Operacional:</span>
                          <span className="font-mono">
                            {formatarMoeda2Casas(
                              resultado.resultadoOperacao.resultadoOperacionalLiquido,
                              'BRL',
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Bloco Financeiro Segregado */}
                      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1.5 text-xs">
                        <span className="text-[10px] uppercase font-bold text-blue-900 block">
                          Resultado Financeiro (Juros Segregados)
                        </span>
                        <div className="flex justify-between py-1 border-b border-blue-100 text-[#1B5E20]">
                          <span>(+) Juros Recebidos (Venda):</span>
                          <span className="font-mono font-semibold">
                            + {formatarMoeda2Casas(resultado.venda.jurosValor, 'BRL')}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-blue-100 text-red-600">
                          <span>(-) Juros Pagos (Compra):</span>
                          <span className="font-mono font-semibold">
                            - {formatarMoeda2Casas(resultado.compra.jurosValor, 'BRL')}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 font-bold text-blue-950">
                          <span>(=) Resultado Financeiro Líquido:</span>
                          <span className="font-mono">
                            {formatarMoeda2Casas(
                              resultado.resultadoOperacao.resultadoFinanceiroLiquido,
                              'BRL',
                            )}
                          </span>
                        </div>
                        <span className="text-[10px] text-blue-800 block pt-1">
                          Diferencial de prazo:{' '}
                          {resultado.venda.prazoDias - resultado.compra.prazoDias} dias
                        </span>
                      </div>

                      {/* Bloco Final */}
                      <div className="p-3.5 rounded-xl border border-emerald-300 bg-gradient-to-br from-emerald-100/70 to-emerald-50 space-y-1.5 text-xs">
                        <span className="text-[10px] uppercase font-bold text-emerald-950 block">
                          Resultado Final da Operação
                        </span>
                        <div className="flex justify-between py-1 border-b border-emerald-200">
                          <span className="text-emerald-900">Resultado Líquido R$:</span>
                          <span className="font-mono font-extrabold text-base text-[#1B5E20]">
                            {formatarMoeda2Casas(
                              resultado.resultadoOperacao.resultadoFinalOperacao,
                              'BRL',
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-emerald-200">
                          <span className="text-emerald-900">Margem s/ Faturamento:</span>
                          <span className="font-mono font-bold text-emerald-950">
                            {formatarValor2Casas(
                              resultado.resultadoOperacao.margemSobreReceitaBrutaPerc,
                            )}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-emerald-900">ROI s/ Custo Compra:</span>
                          <span className="font-mono font-bold text-emerald-950">
                            {formatarValor2Casas(
                              resultado.resultadoOperacao.margemSobreCustoInvestidoPerc,
                            )}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ----------------------------------------------------------- */}
                {/* 4. DRE / CASCATA DE RESULTADOS COMPLETA (3 COLUNAS)         */}
                {/* ----------------------------------------------------------- */}
                <Card className="border-[#DCE5DC] shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-[#F8FAF6] border-b border-[#DCE5DC] py-3.5 px-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#1B5E20]" />
                        <CardTitle className="text-sm font-bold text-[#1C2B1C]">
                          DRE / Cascata Comercial Completa (3 Colunas)
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs font-mono text-[#1B5E20] bg-white border-emerald-300"
                      >
                        Lote: {formatarValor2Casas(resultado.volumeTotal)} {resultado.unidade} (
                        {resultado.qtdEmbalagens} emb.)
                      </Badge>
                    </div>
                  </CardHeader>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F5F7F1] border-b border-[#DCE5DC] text-[#1C2B1C] font-semibold">
                          <th className="py-2.5 px-4 text-left">Estrutura de Resultados (DRE)</th>
                          <th className="py-2.5 px-4 text-right">Unitário (R$)</th>
                          <th className="py-2.5 px-4 text-right">Total do Lote (R$)</th>
                          <th className="py-2.5 px-4 text-right">% s/ Faturamento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {resultado.dre.map((linha, idx) => {
                          const isSubtotal = linha.natureza === 'subtotal'
                          const isResultado = linha.natureza === 'resultado'
                          const isReceita = linha.natureza === 'receita'

                          let rowClass = 'hover:bg-gray-50/70 transition-colors'
                          if (idx % 2 === 1 && !isSubtotal && !isResultado) {
                            rowClass = 'bg-[#FCFDFB] hover:bg-gray-50/70'
                          }
                          if (isSubtotal) {
                            rowClass =
                              'bg-emerald-50/40 border-y border-emerald-100 font-bold text-emerald-950'
                          }
                          if (isResultado) {
                            rowClass = 'bg-[#1B5E20] text-white font-extrabold'
                          }

                          return (
                            <tr key={idx} className={rowClass}>
                              <td
                                className={`py-2.5 px-4 ${isResultado || isSubtotal || isReceita ? 'font-bold' : ''}`}
                              >
                                {linha.descricao}
                              </td>
                              <td
                                className={`py-2.5 px-4 text-right font-mono ${
                                  isResultado ? 'text-amber-300 font-bold' : ''
                                }`}
                              >
                                {formatarMoeda2Casas(linha.unitario, 'BRL')}
                              </td>
                              <td
                                className={`py-2.5 px-4 text-right font-mono font-bold ${
                                  isResultado ? 'text-amber-300 text-sm' : ''
                                }`}
                              >
                                {formatarMoeda2Casas(linha.total, 'BRL')}
                              </td>
                              <td
                                className={`py-2.5 px-4 text-right font-mono font-semibold ${
                                  isResultado ? 'text-white' : 'text-gray-600'
                                }`}
                              >
                                {formatarValor2Casas(linha.percSobreFaturamento)}%
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Preço Mínimo e Preço Sugerido */}
                  <div className="p-4 bg-[#F8FAF6] border-t border-[#DCE5DC] grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-white rounded-lg border border-[#DCE5DC]">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">
                        Preço Mínimo (Break-Even)
                      </span>
                      <span className="text-base font-mono font-bold text-gray-900 block mt-1">
                        {formatarMoeda2Casas(resultado.precoMinimoBreakEven, 'BRL')}
                      </span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        Ponto de equilíbrio (Margem Zero)
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-[#DCE5DC]">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">
                        Markup Multiplicador
                      </span>
                      <span className="text-base font-mono font-bold text-[#1B5E20] block mt-1">
                        {formatarValor2Casas(resultado.markupMultiplicador)}x
                      </span>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        Fator multiplicador sobre o custo
                      </span>
                    </div>

                    <div className="p-3 bg-gradient-to-br from-emerald-100/70 to-emerald-50 rounded-lg border border-emerald-300">
                      <span className="text-[10px] uppercase font-bold text-emerald-950 block">
                        Preço Sugerido (Margem {formatarValor2Casas(margemAlvoPerc)}%)
                      </span>
                      <span className="text-base font-mono font-extrabold text-[#1B5E20] block mt-1">
                        {formatarMoeda2Casas(resultado.precoVendaSugerido, 'BRL')}
                      </span>
                      <span className="text-[10px] text-emerald-800 block mt-0.5 font-medium">
                        Unitário: {formatarMoeda2Casas(resultado.precoVendaSugeridoUnitario, 'BRL')}{' '}
                        / {resultado.unidade}
                      </span>
                    </div>
                  </div>
                </Card>

                {/* ----------------------------------------------------------- */}
                {/* 5. MEMÓRIA DE CÁLCULO SEPARADA (COMPRA, VENDA E RESULTADO)  */}
                {/* ----------------------------------------------------------- */}
                <Card className="border-[#DCE5DC] bg-white shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMostrarMemoriaCalculo(!mostrarMemoriaCalculo)}
                    className="w-full bg-[#F8FAF6] border-b border-[#DCE5DC] py-3 px-5 flex items-center justify-between text-left hover:bg-[#F2F5EF] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-[#1B5E20]" />
                      <span className="text-xs font-bold text-[#1C2B1C]">
                        Memória de Cálculo & Fundamentação Separada de Compra, Venda e Resultado
                      </span>
                      <Badge variant="outline" className="text-[10px] text-gray-500 bg-white">
                        {resultado.memoriaCalculo.length} passos
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#5A6D5A] font-semibold">
                      <span>
                        {mostrarMemoriaCalculo ? 'Recolher detalhes' : 'Expandir memória completa'}
                      </span>
                      {mostrarMemoriaCalculo ? (
                        <ChevronUp className="w-4 h-4 text-[#1B5E20]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#1B5E20]" />
                      )}
                    </div>
                  </button>

                  {mostrarMemoriaCalculo && (
                    <CardContent className="p-4 bg-[#FCFDFB] space-y-3">
                      <ol className="list-decimal list-inside space-y-2 text-xs font-mono text-gray-700">
                        {resultado.memoriaCalculo.map((item, idx) => {
                          const isBlocoCompra =
                            item.includes('[BLOCO COMPRA]') || item.includes('OPERAÇÃO DE COMPRA')
                          const isBlocoVenda =
                            item.includes('[BLOCO VENDA]') || item.includes('OPERAÇÃO DE VENDA')
                          const isBlocoResultado =
                            item.includes('[BLOCO RESULTADO') ||
                            item.includes('RESULTADO CONSOLIDADO')

                          return (
                            <li
                              key={idx}
                              className={`p-2.5 rounded border ${
                                isBlocoCompra
                                  ? 'bg-sky-50 border-sky-300 font-bold text-sky-950'
                                  : isBlocoVenda
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-950'
                                    : isBlocoResultado
                                      ? 'bg-amber-50 border-amber-300 font-bold text-amber-950'
                                      : 'bg-white border-[#DCE5DC]'
                              }`}
                            >
                              <span>{item}</span>
                            </li>
                          )
                        })}
                      </ol>

                      {resultado.alertas.length > 0 && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide mb-1.5">
                            Alertas e Observações Fiscais:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
                            {resultado.alertas.map((alerta, idx) => (
                              <li key={idx}>{alerta}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* ABA 2: BASE DE PRODUTOS */}
          <TabsContent value="produtos" className="mt-0">
            <AbaBaseProdutos ativa={abaAtiva === 'produtos'} />
          </TabsContent>

          {/* ABA 3: REGRAS FISCAIS */}
          <TabsContent value="regras" className="mt-0">
            <AbaRegrasFiscais ativa={abaAtiva === 'regras'} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

export default Simulate
