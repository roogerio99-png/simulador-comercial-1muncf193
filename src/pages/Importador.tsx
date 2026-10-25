import React, { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Trash2,
  Edit,
  Plus,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  Layers,
  Percent,
  Package,
  X,
  Loader2,
  FileText,
  Sliders,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { simuladorDataService } from '@/services/simuladorDataService'
import {
  simuladorImportadorService,
  CAMPOS_PRODUTO_MAP,
  CAMPOS_REGRA_ICMS_MAP,
  type ProgressoLote,
  type ResultadoImportacao,
} from '@/services/simuladorImportadorService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { SimProdutoBase, SimRegraIcms } from '@/types/simulador'

export function Importador() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  // Aba ativa: 'produtos' ou 'regras'
  const [modoAtivo, setModoAtivo] = useState<'produtos' | 'regras'>('produtos')

  // Arquivo carregado
  const [arquivoNome, setArquivoNome] = useState<string>('')
  const [folhasDisponiveis, setFolhasDisponiveis] = useState<string[]>([])
  const [folhaSelecionada, setFolhaSelecionada] = useState<string>('')
  const [linhasLidas, setLinhasLidas] = useState<Record<string, any>[]>([])
  const [colunasPlanilha, setColunasPlanilha] = useState<string[]>([])
  const [mapaColunas, setMapaColunas] = useState<Record<string, string>>({})
  const [lendoArquivo, setLendoArquivo] = useState(false)

  // Estado da Importação
  const [importando, setImportando] = useState(false)
  const [progresso, setProgresso] = useState<ProgressoLote | null>(null)
  const [resultadoFinal, setResultadoFinal] = useState<ResultadoImportacao | null>(null)

  // Lista da Coleção de Destino (para consulta, edição e exclusão)
  const [registrosProd, setRegistrosProd] = useState<SimProdutoBase[]>([])
  const [totalProd, setTotalProd] = useState(0)
  const [pageProd, setPageProd] = useState(1)
  const [totalPagesProd, setTotalPagesProd] = useState(1)
  const [buscaProd, setBuscaProd] = useState('')
  const [loadingProd, setLoadingProd] = useState(false)

  const [registrosIcms, setRegistrosIcms] = useState<SimRegraIcms[]>([])
  const [totalIcms, setTotalIcms] = useState(0)
  const [pageIcms, setPageIcms] = useState(1)
  const [totalPagesIcms, setTotalPagesIcms] = useState(1)
  const [buscaIcms, setBuscaIcms] = useState('')
  const [loadingIcms, setLoadingIcms] = useState(false)

  // Seleção (individual e em massa)
  const [selecionados, setSelecionados] = useState<string[]>([])

  // Modal de Edição / Criação Manual
  const [modalEdicaoAberto, setModalEdicaoAberto] = useState(false)
  const [registroEmEdicao, setRegistroEmEdicao] = useState<any>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // Modal de Confirmação de Exclusão
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false)
  const [itemParaExcluir, setItemParaExcluir] = useState<{ id: string; titulo: string } | null>(
    null,
  )
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // --------------------------------------------------------------------------
  // CARREGAR DADOS DAS COLEÇÕES PRÓPRIAS
  // --------------------------------------------------------------------------
  const carregarProdutos = useCallback(
    async (targetPage = 1) => {
      setLoadingProd(true)
      try {
        const termo = buscaProd.trim().replace(/'/g, "\\'")
        const filter = termo
          ? `codigo ~ '${termo}' || descricao ~ '${termo}' || ncm ~ '${termo}' || principio_ativo ~ '${termo}'`
          : undefined
        const res = await simuladorDataService.listarProdutos(targetPage, 20, filter, '-created')
        setRegistrosProd(res.items)
        setTotalProd(res.totalItems)
        setTotalPagesProd(res.totalPages || 1)
        setPageProd(targetPage)
      } catch (err) {
        console.error('Erro ao listar produtos do simulador:', err)
        setRegistrosProd([])
      } finally {
        setLoadingProd(false)
      }
    },
    [buscaProd],
  )

  const carregarRegrasIcms = useCallback(
    async (targetPage = 1) => {
      setLoadingIcms(true)
      try {
        const termo = buscaIcms.trim().replace(/'/g, "\\'")
        const filter = termo
          ? `uf_origem ~ '${termo}' || uf_destino ~ '${termo}' || grupo_tributario_codigo ~ '${termo}' || id_regra ~ '${termo}'`
          : undefined
        const res = await simuladorDataService.listarRegrasIcms(targetPage, 20, filter, '-created')
        setRegistrosIcms(res.items)
        setTotalIcms(res.totalItems)
        setTotalPagesIcms(res.totalPages || 1)
        setPageIcms(targetPage)
      } catch (err) {
        console.error('Erro ao listar regras de ICMS:', err)
        setRegistrosIcms([])
      } finally {
        setLoadingIcms(false)
      }
    },
    [buscaIcms],
  )

  useEffect(() => {
    // Limpar seleção ao trocar de modo
    setSelecionados([])
    if (modoAtivo === 'produtos') {
      carregarProdutos(1)
    } else {
      carregarRegrasIcms(1)
    }
  }, [modoAtivo, carregarProdutos, carregarRegrasIcms])

  // --------------------------------------------------------------------------
  // UPLOAD E LEITURA DE PLANILHA VIA SHEETJS
  // --------------------------------------------------------------------------
  const handleArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLendoArquivo(true)
    setArquivoNome(file.name)
    setResultadoFinal(null)
    setProgresso(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetNames = workbook.SheetNames || []
      setFolhasDisponiveis(sheetNames)

      if (sheetNames.length === 0) {
        toast({
          title: 'Arquivo sem planilhas',
          description: 'O arquivo enviado não contém abas válidas.',
          variant: 'destructive',
        })
        setLendoArquivo(false)
        return
      }

      // Tenta selecionar automaticamente a aba mais coerente com o modo
      let folhaEscolhida = sheetNames[0]
      if (modoAtivo === 'produtos') {
        const matchProd = sheetNames.find((s) => /produto|itens|cad|base/i.test(s))
        if (matchProd) folhaEscolhida = matchProd
      } else {
        const matchIcms = sheetNames.find((s) => /icms|regra|fiscal|uf/i.test(s))
        if (matchIcms) folhaEscolhida = matchIcms
      }

      setFolhaSelecionada(folhaEscolhida)
      processarFolha(workbook, folhaEscolhida)
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err)
      toast({
        title: 'Erro ao processar planilha',
        description: err.message || 'Formato de planilha inválido ou corrompido.',
        variant: 'destructive',
      })
    } finally {
      setLendoArquivo(false)
    }
  }

  const processarFolha = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) return

    // Converte para JSON com primeira linha como chave
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      blankrows: false,
    })

    if (jsonData.length === 0) {
      setLinhasLidas([])
      setColunasPlanilha([])
      setMapaColunas({})
      return
    }

    setLinhasLidas(jsonData)

    // Extrai nomes de todas as colunas presentes nas linhas
    const colsSet = new Set<string>()
    jsonData.forEach((row) => {
      Object.keys(row).forEach((c) => {
        const trimmed = c.trim()
        if (trimmed) colsSet.add(trimmed)
      })
    })

    const colsArray = Array.from(colsSet)
    setColunasPlanilha(colsArray)

    // Sugere mapeamento inteligente
    const mapaSugerido = simuladorImportadorService.sugerirMapeamento(colsArray, modoAtivo)
    setMapaColunas(mapaSugerido)

    toast({
      title: 'Planilha carregada!',
      description: `${jsonData.length} linhas e ${colsArray.length} colunas detectadas na aba "${sheetName}".`,
    })
  }

  const handleTrocarFolha = (novoNomeFolha: string) => {
    setFolhaSelecionada(novoNomeFolha)
    if (!fileInputRef.current?.files?.[0]) return
    const file = fileInputRef.current.files[0]
    file.arrayBuffer().then((buffer) => {
      const workbook = XLSX.read(buffer, { type: 'array' })
      processarFolha(workbook, novoNomeFolha)
    })
  }

  const atualizarMapeamentoColuna = (colunaPlanilha: string, campoDestino: string) => {
    setMapaColunas((prev) => ({
      ...prev,
      [colunaPlanilha]: campoDestino,
    }))
  }

  // --------------------------------------------------------------------------
  // INICIAR IMPORTAÇÃO EM LOTE
  // --------------------------------------------------------------------------
  const executarImportacao = async () => {
    if (!isAdmin) {
      toast({
        title: 'Permissão negada',
        description: 'Apenas usuários com perfil Administrador podem executar importações.',
        variant: 'destructive',
      })
      return
    }

    if (linhasLidas.length === 0) {
      toast({
        title: 'Nenhum dado',
        description: 'Carregue uma planilha com linhas válidas antes de importar.',
        variant: 'destructive',
      })
      return
    }

    setImportando(true)
    setProgresso({
      processados: 0,
      total: linhasLidas.length,
      criados: 0,
      atualizados: 0,
      falhas: 0,
      mensagem: 'Iniciando importação...',
    })

    try {
      let resultado: ResultadoImportacao

      if (modoAtivo === 'produtos') {
        resultado = await simuladorImportadorService.importarProdutosEmLote(
          linhasLidas,
          mapaColunas,
          (p) => setProgresso(p),
        )
        await carregarProdutos(1)
      } else {
        resultado = await simuladorImportadorService.importarRegrasIcmsEmLote(
          linhasLidas,
          mapaColunas,
          (p) => setProgresso(p),
        )
        await carregarRegrasIcms(1)
      }

      setResultadoFinal(resultado)
      toast({
        title: 'Importação Concluída!',
        description: `${resultado.criados} criados, ${resultado.atualizados} atualizados, ${resultado.falhas} falhas.`,
      })
    } catch (err: any) {
      console.error('Erro na importação:', err)
      toast({
        title: 'Falha durante a importação',
        description: err.message || 'Ocorreu um erro ao gravar os dados.',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  // --------------------------------------------------------------------------
  // SELEÇÃO INDIVIDUAL E EM MASSA
  // --------------------------------------------------------------------------
  const listaAtual = modoAtivo === 'produtos' ? registrosProd : registrosIcms
  const todosSelecionados =
    listaAtual.length > 0 && listaAtual.every((item) => selecionados.includes(item.id))

  const toggleSelecionarTudo = () => {
    if (todosSelecionados) {
      const idsPagina = new Set(listaAtual.map((i) => i.id))
      setSelecionados((prev) => prev.filter((id) => !idsPagina.has(id)))
    } else {
      const novos = Array.from(new Set([...selecionados, ...listaAtual.map((i) => i.id)]))
      setSelecionados(novos)
    }
  }

  const toggleSelecionarItem = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // --------------------------------------------------------------------------
  // EXCLUSÃO INDIVIDUAL E EM MASSA
  // --------------------------------------------------------------------------
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

    try {
      if (excluindoEmMassa) {
        if (modoAtivo === 'produtos') {
          await simuladorImportadorService.excluirProdutosEmMassa(selecionados)
          toast({
            title: 'Exclusão em massa concluída',
            description: `${selecionados.length} produtos foram removidos.`,
          })
          setSelecionados([])
          await carregarProdutos(pageProd)
        } else {
          await simuladorImportadorService.excluirRegrasIcmsEmMassa(selecionados)
          toast({
            title: 'Exclusão em massa concluída',
            description: `${selecionados.length} regras de ICMS foram removidas.`,
          })
          setSelecionados([])
          await carregarRegrasIcms(pageIcms)
        }
      } else if (itemParaExcluir) {
        if (modoAtivo === 'produtos') {
          await simuladorImportadorService.excluirProduto(itemParaExcluir.id)
          toast({ title: 'Produto excluído com sucesso.' })
          setSelecionados((prev) => prev.filter((id) => id !== itemParaExcluir.id))
          await carregarProdutos(pageProd)
        } else {
          await simuladorImportadorService.excluirRegraIcms(itemParaExcluir.id)
          toast({ title: 'Regra de ICMS excluída com sucesso.' })
          setSelecionados((prev) => prev.filter((id) => id !== itemParaExcluir.id))
          await carregarRegrasIcms(pageIcms)
        }
      }
    } catch (err: any) {
      console.error('Erro ao excluir:', err)
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Falha ao remover registro(s).',
        variant: 'destructive',
      })
    } finally {
      setModalExclusaoAberto(false)
      setItemParaExcluir(null)
      setExcluindoEmMassa(false)
    }
  }

  // --------------------------------------------------------------------------
  // EDIÇÃO INDIVIDUAL (MODAL)
  // --------------------------------------------------------------------------
  const abrirModalEdicao = (item: any) => {
    setRegistroEmEdicao({ ...item })
    setModalEdicaoAberto(true)
  }

  const abrirModalNovo = () => {
    if (modoAtivo === 'produtos') {
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
    } else {
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
        fundamentacao_legal: '',
      })
    }
    setModalEdicaoAberto(true)
  }

  const salvarRegistroEmEdicao = async () => {
    setSalvandoEdicao(true)
    try {
      if (modoAtivo === 'produtos') {
        if (!registroEmEdicao.descricao) {
          toast({
            title: 'Campo obrigatório',
            description: 'A Descrição do produto é obrigatória.',
            variant: 'destructive',
          })
          setSalvandoEdicao(false)
          return
        }

        if (registroEmEdicao.id) {
          await simuladorImportadorService.atualizarProduto(registroEmEdicao.id, registroEmEdicao)
          toast({ title: 'Produto atualizado com sucesso!' })
        } else {
          await simuladorImportadorService.criarProduto(registroEmEdicao)
          toast({ title: 'Novo produto cadastrado com sucesso!' })
        }
        await carregarProdutos(pageProd)
      } else {
        if (!registroEmEdicao.uf_origem || !registroEmEdicao.uf_destino) {
          toast({
            title: 'Campos obrigatórios',
            description: 'UF Origem e UF Destino são obrigatórias.',
            variant: 'destructive',
          })
          setSalvandoEdicao(false)
          return
        }

        if (registroEmEdicao.id) {
          await simuladorImportadorService.atualizarRegraIcms(registroEmEdicao.id, registroEmEdicao)
          toast({ title: 'Regra de ICMS atualizada com sucesso!' })
        } else {
          await simuladorImportadorService.criarRegraIcms(registroEmEdicao)
          toast({ title: 'Nova regra de ICMS cadastrada com sucesso!' })
        }
        await carregarRegrasIcms(pageIcms)
      }
      setModalEdicaoAberto(false)
      setRegistroEmEdicao(null)
    } catch (err: any) {
      console.error('Erro ao salvar registro:', err)
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Não foi possível gravar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-[#1D6A43]" />
            Importador & Gestão de Cadastros
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Importação inteligente via XLSX/CSV com mapeamento automático, seleção individual/em
            massa, edição e exclusão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={abrirModalNovo}
            size="sm"
            className="h-8 gap-1.5 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
          >
            <Plus className="w-4 h-4" />
            Novo Registro
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (modoAtivo === 'produtos') carregarProdutos(pageProd)
              else carregarRegrasIcms(pageIcms)
            }}
            className="h-8 gap-1.5 text-xs border-[#E4EAE5] text-[#1E2A24]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#1D6A43]" />
            Recarregar
          </Button>
        </div>
      </div>

      {/* Seletor de Modo Principal: Base de Produtos ou Regras Fiscais */}
      <Tabs
        value={modoAtivo}
        onValueChange={(val: any) => {
          setModoAtivo(val)
          setLinhasLidas([])
          setColunasPlanilha([])
          setArquivoNome('')
          setResultadoFinal(null)
        }}
        className="w-full"
      >
        <TabsList className="grid w-full sm:w-[480px] grid-cols-2">
          <TabsTrigger value="produtos" className="gap-2 text-xs">
            <Package className="w-4 h-4" />
            Base de Produtos ({totalProd})
          </TabsTrigger>
          <TabsTrigger value="regras" className="gap-2 text-xs">
            <Percent className="w-4 h-4" />
            Regras Fiscais ({totalIcms})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* -------------------------------------------------------------------- */}
      {/* SEÇÃO 1: ÁREA DE UPLOAD E MAPEAMENTO DE COLUNAS */}
      {/* -------------------------------------------------------------------- */}
      <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-[#FAFBF9] border-b border-[#E4EAE5] py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-bold text-[#1E2A24] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#1D6A43]" />
                Importar {modoAtivo === 'produtos' ? 'Base de Produtos' : 'Regras Fiscais (ICMS)'}
              </CardTitle>
              <CardDescription className="text-xs text-[#5D6B63]">
                Envie uma planilha XLSX ou CSV para detecção de colunas e importação direta.
              </CardDescription>
            </div>

            {!isAdmin && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
              >
                <ShieldAlert className="w-3 h-3 mr-1" />
                Modo Leitura (Apenas Admin pode importar/excluir)
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Caixa de Upload */}
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${
                  lendoArquivo
                    ? 'border-emerald-300 bg-emerald-50/40'
                    : 'border-[#D1DDD5] hover:border-[#1D6A43] hover:bg-[#F7F9F6]'
                }`}
              >
                <div className="flex flex-col items-center justify-center text-center">
                  <UploadCloud className="w-8 h-8 text-[#1D6A43] mb-2" />
                  <p className="text-xs font-semibold text-[#1E2A24]">
                    {arquivoNome ? arquivoNome : 'Clique ou arraste a planilha XLSX ou CSV aqui'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Compatível com planilhas Excel (.xlsx, .xls) e arquivos CSV.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleArquivoChange}
                  disabled={lendoArquivo || importando}
                />
              </label>
            </div>

            {/* Seleção de Aba da Planilha se houver múltiplas */}
            {folhasDisponiveis.length > 1 && (
              <div className="w-full md:w-64 space-y-1.5 p-3.5 bg-[#FAFBF9] border border-[#E4EAE5] rounded-xl text-xs">
                <span className="font-semibold text-[#1E2A24] text-[11px]">Aba da Planilha:</span>
                <Select value={folhaSelecionada} onValueChange={handleTrocarFolha}>
                  <SelectTrigger className="h-8 text-xs bg-white border-[#E4EAE5]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {folhasDisponiveis.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500">
                  {linhasLidas.length} linhas detectadas nesta aba.
                </p>
              </div>
            )}
          </div>

          {/* Painel de Mapeamento de Colunas (quando o arquivo for lido) */}
          {colunasPlanilha.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#E4EAE5]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#1E2A24] flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#1D6A43]" />
                    Mapeamento de Colunas da Planilha para o Simulador
                  </h4>
                  <p className="text-[11px] text-[#5D6B63]">
                    Revise os campos associados. As colunas não associadas serão preservadas como
                    dados extras.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-700">
                    {colunasPlanilha.length} colunas na planilha
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300"
                  >
                    {linhasLidas.length} linhas para importar
                  </Badge>
                </div>
              </div>

              {/* Grid de Seletores de Mapeamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-3 bg-[#FAFBF9] border border-[#E4EAE5] rounded-xl text-xs">
                {colunasPlanilha.map((col) => {
                  const campoDestino = mapaColunas[col] || '__ignorar__'
                  const listaCampos =
                    modoAtivo === 'produtos' ? CAMPOS_PRODUTO_MAP : CAMPOS_REGRA_ICMS_MAP

                  return (
                    <div
                      key={col}
                      className="p-2.5 rounded-lg border border-[#E4EAE5] bg-white space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="font-semibold text-[#1E2A24] truncate text-[11px]"
                          title={col}
                        >
                          {col}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mx-1" />
                      </div>

                      <Select
                        value={campoDestino}
                        onValueChange={(val) => atualizarMapeamentoColuna(col, val)}
                      >
                        <SelectTrigger className="h-7 text-[11px] border-[#E4EAE5]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignorar__" className="text-[11px] text-slate-400">
                            (Ignorar / Dados extras)
                          </SelectItem>
                          {listaCampos.map((c) => (
                            <SelectItem key={c.key} value={c.key} className="text-[11px]">
                              {c.label} {c.required ? '*' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>

              {/* Pré-visualização das 3 Primeiras Linhas */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Pré-visualização dos dados (amostra inicial):
                </span>
                <div className="overflow-x-auto border border-[#E4EAE5] rounded-xl bg-white max-h-40">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-[#FAFBF9] border-b border-[#E4EAE5] text-slate-600">
                      <tr>
                        {colunasPlanilha.slice(0, 7).map((c) => (
                          <th
                            key={c}
                            className="py-1.5 px-2.5 font-semibold truncate max-w-[150px]"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                      {linhasLidas.slice(0, 3).map((r, i) => (
                        <tr key={i}>
                          {colunasPlanilha.slice(0, 7).map((c) => (
                            <td key={c} className="py-1.5 px-2.5 truncate max-w-[150px]">
                              {String(r[c] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Ação de Iniciar Importação */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500">
                  A importação utilizará upsert idempotente (atualiza registros existentes e
                  cadastra novos).
                </div>

                <Button
                  onClick={executarImportacao}
                  disabled={importando || !isAdmin}
                  className="w-full sm:w-auto h-9 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white gap-2 font-semibold shadow-sm"
                >
                  {importando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando no Banco de Dados...
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      Importar {linhasLidas.length} Registros para o Simulador
                    </>
                  )}
                </Button>
              </div>

              {/* Barra de Progresso em Tempo Real */}
              {progresso && (
                <div className="p-4 bg-[#F7F9F6] border border-[#E4EAE5] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1E2A24] flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D6A43]" />
                      {progresso.mensagem}
                    </span>
                    <span className="font-mono font-bold text-[#1D6A43]">
                      {Math.round((progresso.processados / progresso.total) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.round((progresso.processados / progresso.total) * 100)}
                    className="h-2 bg-slate-200"
                  />
                  <div className="flex items-center gap-4 text-[11px] text-slate-600 pt-1">
                    <span>
                      Processados: {progresso.processados} / {progresso.total}
                    </span>
                    <span className="text-emerald-700 font-semibold">
                      Criados: {progresso.criados}
                    </span>
                    <span className="text-sky-700 font-semibold">
                      Atualizados: {progresso.atualizados}
                    </span>
                    {progresso.falhas > 0 && (
                      <span className="text-red-600 font-semibold">Falhas: {progresso.falhas}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Resumo Final da Importação */}
              {resultadoFinal && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Resumo do Processamento:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <span className="text-slate-500 text-[10px]">Total Linhas:</span>
                      <p className="font-bold text-[#1E2A24]">{resultadoFinal.total}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <span className="text-emerald-600 text-[10px]">Novos Criados:</span>
                      <p className="font-bold text-emerald-700">{resultadoFinal.criados}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <span className="text-sky-600 text-[10px]">Atualizados:</span>
                      <p className="font-bold text-sky-700">{resultadoFinal.atualizados}</p>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-100">
                      <span className="text-red-500 text-[10px]">Falhas / Ignorados:</span>
                      <p className="font-bold text-red-600">{resultadoFinal.falhas}</p>
                    </div>
                  </div>

                  {resultadoFinal.erros.length > 0 && (
                    <div className="pt-2 text-[11px] text-red-700 space-y-1">
                      <span className="font-semibold">
                        Primeiras ocorrências de inconsistência:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                        {resultadoFinal.erros.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------------- */}
      {/* SEÇÃO 2: TABELA DE REGISTROS CADASTRADOS, SELEÇÃO E AÇÕES EM MASSA */}
      {/* -------------------------------------------------------------------- */}
      <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Barra de Filtros e Ações em Massa */}
        <div className="p-4 bg-[#FAFBF9] border-b border-[#E4EAE5] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={modoAtivo === 'produtos' ? buscaProd : buscaIcms}
                onChange={(e) =>
                  modoAtivo === 'produtos'
                    ? setBuscaProd(e.target.value)
                    : setBuscaIcms(e.target.value)
                }
                placeholder={
                  modoAtivo === 'produtos'
                    ? 'Buscar produto por código, descrição ou NCM...'
                    : 'Buscar regra por UF origem, destino ou GrTrib...'
                }
                className="pl-9 text-xs h-9 bg-white border-[#E4EAE5]"
              />
            </div>

            <Button
              size="sm"
              onClick={() => {
                if (modoAtivo === 'produtos') carregarProdutos(1)
                else carregarRegrasIcms(1)
              }}
              className="h-9 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
            >
              Filtrar
            </Button>
          </div>

          {/* Botão de Excluir Selecionados em Massa */}
          {selecionados.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-emerald-50 text-[#1D6A43] border-emerald-300 text-xs"
              >
                {selecionados.length} selecionado(s)
              </Badge>

              {isAdmin ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={confirmarExclusaoMassa}
                  className="h-9 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white"
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
          )}
        </div>

        {/* Tabela de Produtos */}
        {modoAtivo === 'produtos' && (
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
                  <th className="py-3 px-3 min-w-[220px]">Descrição Comercial</th>
                  <th className="py-3 px-3">NCM</th>
                  <th className="py-3 px-3">Origem</th>
                  <th className="py-3 px-3">Embalagem</th>
                  <th className="py-3 px-3">GrTrib</th>
                  <th className="py-3 px-3 text-right">Preço Sugerido</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingProd ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                      Carregando produtos cadastrados...
                    </td>
                  </tr>
                ) : registrosProd.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Nenhum produto cadastrado no momento.
                    </td>
                  </tr>
                ) : (
                  registrosProd.map((p) => {
                    const isSelected = selecionados.includes(p.id)
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#F7F9F6] transition-colors ${
                          isSelected ? 'bg-emerald-50/50' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
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
                        <td className="py-2.5 px-3 text-slate-600">{p.embalagem || '—'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{p.gr_trib || '—'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#1E2A24]">
                          {(p.preco_base_sugerido || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirModalEdicao(p)}
                              className="h-7 w-7 text-slate-500 hover:text-[#1D6A43] hover:bg-emerald-50"
                              title="Editar registro"
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
                                title="Excluir registro"
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
        )}

        {/* Tabela de Regras Fiscais (ICMS) */}
        {modoAtivo === 'regras' && (
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
                  <th className="py-3 px-3">GrTrib</th>
                  <th className="py-3 px-3">ID Regra</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingIcms ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1D6A43]" />
                      Carregando regras de ICMS...
                    </td>
                  </tr>
                ) : registrosIcms.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      Nenhuma regra de ICMS cadastrada.
                    </td>
                  </tr>
                ) : (
                  registrosIcms.map((r) => {
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
                        <td className="py-2.5 px-3 text-slate-600">
                          {r.reducao_base ? `${r.reducao_base}%` : '0%'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-[#1D6A43]">
                          {r.aliquota_efetiva !== undefined ? `${r.aliquota_efetiva}%` : '—'}
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
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {r.grupo_tributario_codigo || 'Geral'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                          {r.id_regra || '—'}
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
                                    `Regra ICMS ${r.uf_origem} → ${r.uf_destino} (${r.id_regra || ''})`,
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
        )}

        {/* Rodapé e Paginação da Coleção */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-[#E4EAE5] bg-[#FAFBF9] text-xs text-[#5D6B63]">
          <div>
            Mostrando {modoAtivo === 'produtos' ? registrosProd.length : registrosIcms.length} de{' '}
            {modoAtivo === 'produtos' ? totalProd : totalIcms} registros
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (modoAtivo === 'produtos') carregarProdutos(Math.max(1, pageProd - 1))
                else carregarRegrasIcms(Math.max(1, pageIcms - 1))
              }}
              disabled={
                (modoAtivo === 'produtos' ? pageProd <= 1 : pageIcms <= 1) ||
                loadingProd ||
                loadingIcms
              }
              className="h-7 text-xs border-[#E4EAE5]"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Anterior
            </Button>
            <span className="font-semibold px-2 text-[#1E2A24]">
              {modoAtivo === 'produtos' ? pageProd : pageIcms} /{' '}
              {modoAtivo === 'produtos' ? totalPagesProd : totalPagesIcms}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (modoAtivo === 'produtos')
                  carregarProdutos(Math.min(totalPagesProd, pageProd + 1))
                else carregarRegrasIcms(Math.min(totalPagesIcms, pageIcms + 1))
              }}
              disabled={
                (modoAtivo === 'produtos'
                  ? pageProd >= totalPagesProd
                  : pageIcms >= totalPagesIcms) ||
                loadingProd ||
                loadingIcms
              }
              className="h-7 text-xs border-[#E4EAE5]"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL DE EDIÇÃO OU NOVO REGISTRO */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={modalEdicaoAberto} onOpenChange={setModalEdicaoAberto}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1E2A24] flex items-center gap-2">
              <Edit className="w-4 h-4 text-[#1D6A43]" />
              {registroEmEdicao?.id ? 'Alterar Cadastro' : 'Novo Cadastro'} —{' '}
              {modoAtivo === 'produtos' ? 'Produto' : 'Regra Fiscal ICMS'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os campos de acordo com as colunas da base cadastral.
            </DialogDescription>
          </DialogHeader>

          {registroEmEdicao && modoAtivo === 'produtos' && (
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

          {registroEmEdicao && modoAtivo === 'regras' && (
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
              onClick={salvarRegistroEmEdicao}
              disabled={salvandoEdicao}
              className="h-8 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
            >
              {salvandoEdicao ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* -------------------------------------------------------------------- */}
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
                    {selecionados.length} registros selecionados
                  </strong>{' '}
                  da coleção{' '}
                  {modoAtivo === 'produtos' ? 'simulador_produtos' : 'simulador_regras_icms'}? Esta
                  ação não pode ser desfeita.
                </>
              ) : (
                <>
                  Você tem certeza que deseja excluir o registro{' '}
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
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={executarExclusao}
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar e Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Importador
