/**
 * src/pages/Importador.tsx
 *
 * Página de Importação de Planilhas do Simulador Comercial.
 * Espelha fielmente a UI/UX, motor de mapeamento canônico, validações,
 * relatório de métricas, diagnóstico de erros e download de CSV do aplicativo de referência "Validação de Cadastro",
 * direcionando exclusivamente para as coleções PRÓPRIAS deste projeto:
 *  - 'simulador_produtos' (Simulador: Produtos Base)
 *  - 'simulador_regras_icms' (Simulador: Regras de ICMS)
 */

import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  ArrowRight,
  Download,
  ChevronRight,
  ChevronDown,
  Layers,
  Info,
  Database,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { readSpreadsheetFile, ParsedTable } from '@/lib/importer/csvParser'
import {
  formatarNcmCanonico,
  extrairEmbalagemDescricao,
  extrairFabricanteAgenciado,
  derivarOrigemProduto,
  normalizarUnidadeProduto,
  derivarTipoProdutoCanonico,
} from '@/lib/simProdutosBaseMapeamento'
import { mapearLinhaSimRegraIcms } from '@/lib/simRegrasIcmsMapeamento'
import {
  importarEmLoteSimulador,
  ItemErroImportacao,
  ResultadoImportacaoLote,
} from '@/services/simuladorBatchService'
import { ScrollableTable } from '@/components/ScrollableTable'

interface ZoneConfig {
  id: string
  sheetIndex: number
  sheetKeywords: string[]
  title: string
  subtitle: string
  targetCollection: 'simulador_produtos' | 'simulador_regras_icms'
  expectedHeaders: string[]
  sampleDescription: string
}

export const DROP_ZONES: ZoneConfig[] = [
  {
    id: 'simulador_produtos',
    sheetIndex: 0,
    sheetKeywords: [
      'produtos base',
      'produtos_base',
      'produtosbase',
      'produtos',
      'itens base',
      'simulador produtos',
      'sheet 1',
    ],
    title: 'Simulador: Produtos Base',
    subtitle: 'Cadastro de itens e insumos base para o Simulador Comercial (≈1.178 itens).',
    targetCollection: 'simulador_produtos',
    expectedHeaders: ['CODIGO', 'DESCRICAO', 'NCM', 'UNIDADE', 'ORIGEM', 'TIPO PRODUTO'],
    sampleDescription: 'Popula os produtos selecionáveis no Simulador Comercial',
  },
  {
    id: 'simulador_regras_icms',
    sheetIndex: 1,
    sheetKeywords: [
      'regra icms',
      'regras icms',
      'regra_icms',
      'regras_icms',
      'regras icms interestaduais',
      'regras_icms_interestaduais',
      'icms',
      'matriz icms',
      'tabela icms',
      'regrasicms',
      'regraicms',
      'sheet 2',
    ],
    title: 'Simulador: Regras de ICMS',
    subtitle:
      'Matriz interestadual de alíquotas e benefícios de ICMS origem → destino (≈7.291 regras).',
    targetCollection: 'simulador_regras_icms',
    expectedHeaders: [
      'UF ORIGEM',
      'UF CONTRAPARTIDA / DESTINO',
      'OPERAÇÃO',
      'GRTRIB',
      'CARGA TRIB. ICMS',
      'CARGA ICMS FINAL',
    ],
    sampleDescription: 'Popula a matriz interestadual de ICMS do Simulador Comercial',
  },
]

// Normalização de strings para comparação e busca flexível
export const normalize = (str: string) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

// Helper para obter valor de uma coluna por palavras-chave com prioridade de exatidão
export function getFieldValue(row: Record<string, string>, targetAliases: string[]): string {
  const rowEntries = Object.entries(row)

  // 1ª passada: match exato no nome normalizado
  for (const alias of targetAliases) {
    const normAlias = normalize(alias)
    for (const [key, val] of rowEntries) {
      if (normalize(key) === normAlias && val !== undefined && val !== null) {
        return String(val).trim()
      }
    }
  }

  // 2ª passada: se o nome normalizado da coluna começa com o alias
  for (const alias of targetAliases) {
    const normAlias = normalize(alias)
    for (const [key, val] of rowEntries) {
      const normKey = normalize(key)
      if (normKey.startsWith(normAlias) && val !== undefined && val !== null) {
        return String(val).trim()
      }
    }
  }

  // 3ª passada: substring match
  for (const alias of targetAliases) {
    const normAlias = normalize(alias)
    for (const [key, val] of rowEntries) {
      const normKey = normalize(key)
      if (normKey.includes(normAlias) && val !== undefined && val !== null) {
        return String(val).trim()
      }
    }
  }

  return ''
}

// Limpeza e coerção de NCM: retira pontuação e completa 8 dígitos se veio com zeros omitidos
export function cleanNcm(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 7 && digits.length <= 8) {
    return digits.padStart(8, '0')
  }
  return digits
}

// Coerção numérica brasileira e internacional (trata '12,5', '12.5', '1.200,50')
export function cleanNumber(raw: string): number {
  if (!raw) return 0
  let str = String(raw).trim()
  if (!str) return 0

  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    str = str.replace(',', '.')
  }

  const cleaned = str.replace(/[^\d.-]/g, '')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

export function Importador() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()
  const [dumpLines, setDumpLines] = useState<string>('')

  const [activeZone, setActiveZone] = useState<ZoneConfig>(DROP_ZONES[0])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const [parsedData, setParsedData] = useState<ParsedTable | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Status de importação
  const [importing, setImporting] = useState<boolean>(false)
  const [progress, setProgress] = useState<number>(0)
  const [importSummary, setImportSummary] = useState<ResultadoImportacaoLote | null>(null)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null)
  const [expandedErrorRow, setExpandedErrorRow] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectZone = (zone: ZoneConfig) => {
    setActiveZone(zone)
    setValidationError(null)
    setImportSummary(null)
    setProgress(0)

    // Se já houver um arquivo XLSX aberto com múltiplas abas, troca para a aba correspondente
    if (selectedFile && availableSheets.length > 0) {
      carregarArquivo(selectedFile, zone.sheetIndex)
    }
  }

  const carregarArquivo = async (file: File, sheetIndexOrName?: number | string) => {
    setFileName(file.name)
    setSelectedFile(file)
    setValidationError(null)
    setImportSummary(null)
    setProgress(0)

    try {
      const targetSheet = sheetIndexOrName !== undefined ? sheetIndexOrName : activeZone.sheetIndex
      const table = await readSpreadsheetFile(file, targetSheet)

      if (table.sheetNames && table.sheetNames.length > 0) {
        setAvailableSheets(table.sheetNames)
        const sheetEfetiva = table.sheetName || table.sheetNames[0]
        setSelectedSheet(sheetEfetiva)

        // Sincroniza a DropZone ativa automaticamente se a aba corresponder a outro destino
        const matchingZone = DROP_ZONES.find((z) => {
          const normS = normalize(sheetEfetiva)
          return z.sheetKeywords.some((k) => normS.includes(normalize(k)))
        })
        if (matchingZone && matchingZone.id !== activeZone.id) {
          setActiveZone(matchingZone)
        }
      }

      if (table.headers.length === 0 || table.rows.length === 0) {
        throw new Error('A planilha selecionada está vazia ou não possui linhas de dados válidas.')
      }

      setParsedData(table)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo.'
      setValidationError(msg)
      setParsedData(null)
    }
  }

  const handleFileChange = async (file: File) => {
    await carregarArquivo(file, activeZone.sheetIndex)
  }

  const handleSheetChange = async (newSheetName: string) => {
    if (!selectedFile) return
    setSelectedSheet(newSheetName)
    await carregarArquivo(selectedFile, newSheetName)
  }

  // Prepara e valida os registros antes de enviar ao banco
  const processarLinhasParaImportacao = () => {
    if (!parsedData || parsedData.rows.length === 0) return { validos: [], rejeitados: [] }

    const targetCol = activeZone.targetCollection
    const validos: { data: Record<string, unknown>; originalLine?: number }[] = []
    const rejeitados: ItemErroImportacao[] = []

    parsedData.rows.forEach((row, idx) => {
      const originalLineNum = parsedData.rowIndices?.[idx] ?? idx + 2

      // ------------------------------------------------------------------
      // SIMULADOR: simulador_produtos (Aba Produtos Base)
      // ------------------------------------------------------------------
      if (targetCol === 'simulador_produtos') {
        const codigo = getFieldValue(row, ['b1_cod', 'codigo', 'cod', 'id_produto', 'id', 'item'])

        // Descrição do produto: B1_DESC é a descrição real do produto; NUNCA BM_DESC (que é o grupo)
        let desc = getFieldValue(row, ['b1_desc'])
        if (!desc) {
          const rawDesc = getFieldValue(row, [
            'descricao_produto',
            'nome_produto',
            'descricao',
            'produto',
            'nome',
            'item',
          ])
          const bmDesc = getFieldValue(row, ['bm_desc', 'desc_grupo', 'grupo_desc'])
          if (rawDesc && (!bmDesc || normalize(rawDesc) !== normalize(bmDesc))) {
            desc = rawDesc
          }
        }

        const bmDesc = getFieldValue(row, ['bm_desc', 'desc_grupo', 'grupo_desc', 'grupo'])
        const b1Grupo = getFieldValue(row, ['b1_grupo', 'cod_grupo'])

        if (!desc) {
          desc = getFieldValue(row, ['descricao', 'produto', 'item'])
        }

        // NCM: B1_POSIPI prioridade máxima
        const rawNcm = getFieldValue(row, [
          'b1_posipi',
          'posipi',
          'ncm',
          'ncm_oficial',
          'classificacao_fiscal',
        ])
        const ncmFormatado = formatarNcmCanonico(rawNcm)

        // Embalagem: coluna explícita ou dedução refinada
        let emb = getFieldValue(row, [
          'embalagem',
          'tipo_embalagem',
          'acondicionamento',
          'recipiente',
        ])
        if (!emb && desc) {
          emb = extrairEmbalagemDescricao(desc)
        }

        // Unidade
        const rawUnid = getFieldValue(row, ['b1_um', 'unidade', 'und', 'uom', 'unid'])
        const unid = normalizarUnidadeProduto(rawUnid, emb, desc, bmDesc, b1Grupo)

        // Origem com anti-contaminação
        const x5Origem = getFieldValue(row, [
          'x5_tabela',
          'x5_desc',
          'x5',
          'origem',
          'procedencia',
          'pais_origem',
          'tipo_origem',
        ])
        const origem = derivarOrigemProduto(x5Origem, desc, emb)

        // Fabricante
        let fab = getFieldValue(row, ['fabricante', 'titular', 'empresa', 'fornecedor', 'marca'])
        if (!fab && desc) {
          fab = extrairFabricanteAgenciado(desc)
        }

        // Tipo de produto
        let tipoProd = getFieldValue(row, ['tipo_produto', 'tipo', 'categoria', 'classe'])
        if (!tipoProd) {
          tipoProd = derivarTipoProdutoCanonico('', bmDesc, b1Grupo, desc)
        }

        // Grupo Tributário
        const grTrib = getFieldValue(row, [
          'b1_grtrib2',
          'grtrib2',
          'gr_trib',
          'grtrib',
          'grupo_tributario',
          'grupo_tributario_codigo',
          'cod_grtrib',
        ])

        // Coluna C: grupo_codigo (B1_GRUPO)
        const grupoCodigo =
          getFieldValue(row, ['b1_grupo', 'b1_grupo_original', 'grupo_codigo', 'cod_grupo']) ||
          b1Grupo ||
          ''

        // Coluna D: grupo_descricao (BM_DESC)
        const grupoDescricao =
          getFieldValue(row, [
            'bm_desc',
            'bm_desc_original',
            'grupo_descricao',
            'desc_grupo',
            'grupo_desc',
          ]) ||
          bmDesc ||
          ''

        // Coluna G: descricao_grupo_tributario ("DESCRIÇÃO GRUPO TRIBUTARIO")
        let descGrupoTrib =
          getFieldValue(row, [
            'descrição grupo tributario',
            'descricao grupo tributario',
            'descrição do grupo tributário',
            'descricao_grupo_tributario',
            'desc_grupo_tributario',
            'desc_grtrib',
          ]) || ''
        if (!descGrupoTrib && x5Origem) {
          const x5Up = x5Origem.toUpperCase()
          if ((x5Up.includes('ORIGEM') && x5Up.includes('(NCM')) || x5Up.includes('TRIBUTAD')) {
            descGrupoTrib = x5Origem
          }
        }

        // Coluna H: segmento ("SEGMENTO")
        const segmento = getFieldValue(row, ['segmento', 'seg']) || ''

        // Coluna I: comissao_padrao ("COMISSAO_PADRAO")
        const rawComissao = getFieldValue(row, [
          'comissao_padrao',
          'comissao',
          'comissao_padrao_perc',
          'taxa_comissao',
        ])
        const comissaoPadrao = rawComissao ? cleanNumber(rawComissao) : 0

        // Moeda e Preço
        const moeda =
          getFieldValue(row, ['moeda', 'currency']) || (origem === 'Importado' ? 'USD' : 'BRL')
        const precoBase = cleanNumber(
          getFieldValue(row, [
            'preco_base_sugerido',
            'preco_base',
            'b1_prv1',
            'prv1',
            'preco',
            'preco_venda',
            'valor_unitario',
            'valor',
          ]),
        )

        const pa = getFieldValue(row, ['principio_ativo', 'ativo', 'ingrediente_ativo', 'molecula'])

        const allText = Object.values(row).join(' ').trim()
        if (
          allText.toLowerCase().includes('como usar') ||
          allText.toLowerCase().includes('instruções') ||
          allText.toLowerCase().includes('resumo quantitativo')
        ) {
          rejeitados.push({
            linhaOriginal: originalLineNum,
            linhaLote: idx + 1,
            motivo: 'Linha informativa ou instruções ignorada.',
            categoria: 'Linha Informativa',
            campo: 'Linha',
            valor: allText.slice(0, 60),
            dados: row,
          })
          return
        }

        if (!desc || /^\d+$/.test(desc.trim())) {
          rejeitados.push({
            linhaOriginal: originalLineNum,
            linhaLote: idx + 1,
            motivo: 'Descrição do produto é obrigatória e não pode ser número puro.',
            categoria: 'Descrição Ausente ou Numérica',
            campo: 'Descricao',
            valor: desc || 'vazio',
            dados: row,
          })
          return
        }

        validos.push({
          originalLine: originalLineNum,
          data: {
            codigo: codigo || `PROD-${originalLineNum}`,
            descricao: desc,
            ncm: ncmFormatado,
            unidade: unid,
            tipo_produto: tipoProd,
            origem: origem,
            embalagem: emb || '',
            principio_ativo: pa || '',
            fabricante: fab || '',
            moeda: moeda.toUpperCase() as 'BRL' | 'USD',
            preco_base_sugerido: precoBase,
            gr_trib: grTrib || '',
            grupo_codigo: grupoCodigo || undefined,
            grupo_descricao: grupoDescricao || undefined,
            descricao_grupo_tributario: descGrupoTrib || undefined,
            segmento: segmento || undefined,
            comissao_padrao: comissaoPadrao || undefined,
            dados_extras: {
              ...row,
              ...(bmDesc ? { BM_DESC_ORIGINAL: bmDesc } : {}),
              ...(b1Grupo ? { B1_GRUPO_ORIGINAL: b1Grupo } : {}),
            },
          },
        })
      }

      // ------------------------------------------------------------------
      // SIMULADOR: simulador_regras_icms (Aba Regras de ICMS)
      // ------------------------------------------------------------------
      else if (targetCol === 'simulador_regras_icms') {
        const allText = Object.values(row).join(' ').trim()
        const lowerAll = allText.toLowerCase()
        if (
          lowerAll.includes('como usar') ||
          lowerAll.includes('regras oficiais') ||
          lowerAll.includes('instruções') ||
          lowerAll.includes('instrucoes')
        ) {
          rejeitados.push({
            linhaOriginal: originalLineNum,
            linhaLote: idx + 1,
            motivo: 'Linha informativa ou cabeçalho ignorado.',
            categoria: 'Linha Informativa',
            campo: 'Linha',
            valor: allText.slice(0, 60),
            dados: row,
          })
          return
        }

        const resMapeamento = mapearLinhaSimRegraIcms(row)
        if (!resMapeamento.sucesso) {
          rejeitados.push({
            linhaOriginal: originalLineNum,
            linhaLote: idx + 1,
            motivo: resMapeamento.motivo,
            categoria: 'UF Inválida',
            campo: resMapeamento.campo,
            valor: resMapeamento.valor,
            dados: row,
          })
          return
        }

        validos.push({
          originalLine: originalLineNum,
          data: resMapeamento.regra as unknown as Record<string, unknown>,
        })
      }
    })

    return { validos, rejeitados }
  }

  // Executa a importação dos válidos
  const handleExecutarImportacao = async () => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem importar dados para o banco.',
      })
      return
    }
    if (!parsedData || parsedData.rows.length === 0) return
    setImporting(true)
    setProgress(0)

    try {
      const targetCol = activeZone.targetCollection
      const { validos, rejeitados } = processarLinhasParaImportacao()

      if (validos.length === 0 && rejeitados.length === 0) {
        throw new Error('Nenhum registro correspondente foi identificado para importação.')
      }

      // Pré-cálculo de chaves de identificação únicas no lote para detectar duplicidades intra-planilha
      const contagemChavesPlanilha: Record<string, number> = {}
      validos.forEach((v) => {
        const itemData = v.data as Record<string, unknown>
        let chave: string | null = null
        if (targetCol === 'simulador_produtos') {
          // Identidade composta: Código + Embalagem (variantes de embalagem convivem como produtos distintos)
          const cod = String(itemData.codigo || '')
            .trim()
            .toUpperCase()
          const emb = String(itemData.embalagem || '')
            .trim()
            .toUpperCase()
          const desc = String(itemData.descricao || '')
            .trim()
            .toUpperCase()
          if (cod) {
            chave = emb ? `${cod} | ${emb}` : cod
          } else if (desc) {
            chave = emb ? `${desc} | ${emb}` : desc
          }
        } else if (targetCol === 'simulador_regras_icms') {
          chave = (itemData.chave_origem_destino as string) || null
        }
        if (chave) {
          contagemChavesPlanilha[chave] = (contagemChavesPlanilha[chave] || 0) + 1
        }
      })

      const duplicadasPlanilhaMap: Record<string, number> = {}
      Object.entries(contagemChavesPlanilha).forEach(([k, count]) => {
        if (count > 1) {
          duplicadasPlanilhaMap[k] = count
        }
      })

      // Grava no banco de dados com tratamento de rate-limit e upsert idempotente
      let resultadoLote: ResultadoImportacaoLote = {
        inseridos: 0,
        atualizados: 0,
        ignorados: 0,
        erros: [],
        resumoCategorias: {},
      }

      if (validos.length > 0) {
        resultadoLote = await importarEmLoteSimulador(targetCol, validos, (processados, total) => {
          setProgress(Math.round((processados / total) * 100))
        })
      }

      // Consolidar contagem de duplicadas intra-planilha
      const todasDuplicadas: Record<string, number> = { ...duplicadasPlanilhaMap }
      if (resultadoLote.duplicadasNoLote) {
        for (const [k, v] of Object.entries(resultadoLote.duplicadasNoLote)) {
          todasDuplicadas[k] = Math.max(todasDuplicadas[k] || 0, v)
        }
      }

      // Consolidar erros prévios de validação com erros retornados pelo PocketBase
      const todosErros = [...rejeitados, ...resultadoLote.erros]
      const categoriasConsolidadas = { ...resultadoLote.resumoCategorias }
      rejeitados.forEach((r) => {
        categoriasConsolidadas[r.categoria] = (categoriasConsolidadas[r.categoria] || 0) + 1
      })

      const finalResult: ResultadoImportacaoLote = {
        inseridos: resultadoLote.inseridos,
        atualizados: resultadoLote.atualizados ?? 0,
        atualizadosIntraLote: resultadoLote.atualizadosIntraLote ?? 0,
        atualizadosPreExistentes: resultadoLote.atualizadosPreExistentes ?? 0,
        ignorados: resultadoLote.ignorados,
        duplicadasNoLote: todasDuplicadas,
        erros: todosErros,
        resumoCategorias: categoriasConsolidadas,
      }

      setImportSummary(finalResult)

      const totalGravados = finalResult.inseridos + (finalResult.atualizados || 0)
      if (totalGravados > 0 || finalResult.ignorados > 0) {
        toast({
          title: 'Importação Concluída com Sucesso!',
          description: `${finalResult.inseridos} registros inseridos e ${finalResult.atualizados || 0} atualizados na coleção "${targetCol}".`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Atenção na Importação',
          description: 'Nenhum registro pôde ser processado. Verifique os avisos abaixo.',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na rotina de importação.'
      toast({ variant: 'destructive', title: 'Erro de Importação', description: msg })
    } finally {
      setImporting(false)
    }
  }

  // Exportar relatório de erros em CSV com separador ';' e BOM UTF-8
  const exportarErrosCsv = () => {
    if (!importSummary || importSummary.erros.length === 0) return

    const headers = [
      'Linha_Planilha',
      'Categoria_Erro',
      'Motivo',
      'Campo_Problema',
      'Valor_Identificado',
    ]
    const csvRows = [headers.join(';')]

    importSummary.erros.forEach((e) => {
      const row = [
        e.linhaOriginal,
        `"${e.categoria.replace(/"/g, '""')}"`,
        `"${e.motivo.replace(/"/g, '""')}"`,
        `"${(e.campo || '').replace(/"/g, '""')}"`,
        `"${(e.valor || '').replace(/"/g, '""')}"`,
      ]
      csvRows.push(row.join(';'))
    })

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `erros_importacao_${activeZone.id}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Download Iniciado',
      description: 'O CSV com as linhas que apresentaram erro foi gerado.',
    })
  }

  const errosFiltrados = importSummary
    ? selectedCategoryFilter
      ? importSummary.erros.filter((e) => e.categoria === selectedCategoryFilter)
      : importSummary.erros
    : []

  return (
    <div className="space-y-6 animate-in fade-in-up duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1C2B1C] flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-[#1B5E20]" />
            <span>Central de Importação de Planilhas</span>
          </h2>
          <p className="text-xs text-[#5A6D5A] mt-0.5">
            Importador canônico com detecção inteligente de abas Excel (.xlsx / .csv), upsert
            idempotente e gravação direta nas coleções do Simulador Comercial (
            <code className="text-[#1B5E20] font-semibold">simulador_produtos</code> e{' '}
            <code className="text-[#1B5E20] font-semibold">simulador_regras_icms</code>).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                // Obter asset
                const xlsxUrl = (await import('@/assets/simuladordeoperacoesv3completo-eef50.xlsx?url')).default
                const resp = await fetch(xlsxUrl)
                const blob = await resp.blob()
                const formData = new FormData()
                formData.append('arquivo', blob, 'simulador.xlsx')
                const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''
                const res = await fetch(`${pbUrl}/backend/v1/simulador/inspecionar-referencia`, {
                  method: 'POST',
                  body: formData,
                })
                const json = await res.json()
                if (json.markdown) {
                  setDumpLines(json.markdown)
                } else {
                  // Fallback para getReferenceSheetRows
                  const { getReferenceSheetRows } = await import('@/lib/importer/csvParser')
                  const lines = await getReferenceSheetRows()
                  setDumpLines(lines.join('\n'))
                }
              } catch (e) {
                console.error(e)
                const { getReferenceSheetRows } = await import('@/lib/importer/csvParser')
                const lines = await getReferenceSheetRows()
                setDumpLines(lines.join('\n'))
              }
            }}
            className="h-8 text-xs border-emerald-300 text-[#1B5E20]"
          >
            Ver Modelo da Planilha
          </Button>
          <Badge
            variant="outline"
            className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 px-3 py-1 flex items-center gap-1.5"
          >
            <Database className="w-3.5 h-3.5 text-[#1B5E20]" />
            <span>Coleções Próprias do Simulador</span>
          </Badge>
        </div>
      </div>

      {dumpLines && (
        <Card className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] max-h-96 overflow-auto border border-emerald-500/30">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-emerald-800">
            <span className="font-bold">DUMP DO MODELO CANÔNICO DA PLANILHA (Fórmulas e Rótulos)</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDumpLines('')}
              className="h-6 text-xs text-rose-400 hover:text-rose-300"
            >
              Fechar
            </Button>
          </div>
          <pre className="whitespace-pre-wrap leading-tight">{dumpLines}</pre>
        </Card>
      )}

      {/* 2 ZONAS DE DESTINO DO SIMULADOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DROP_ZONES.map((zone) => {
          const isSelected = activeZone.id === zone.id
          return (
            <div
              key={zone.id}
              onClick={() => handleSelectZone(zone)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 text-left bg-white shadow-sm flex flex-col justify-between ${
                isSelected
                  ? 'border-[#1B5E20] ring-2 ring-emerald-600/30 shadow-md bg-emerald-50/20'
                  : 'border-[#DCE5DC] hover:border-emerald-300 hover:bg-[#F5F7F1]/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isSelected ? 'bg-[#1B5E20] text-white' : 'bg-emerald-50 text-[#1B5E20]'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  {isSelected && (
                    <Badge className="bg-[#1B5E20] text-white text-[10px] py-0 px-2">
                      Aba Ativa
                    </Badge>
                  )}
                </div>
                <h3 className="font-bold text-xs text-[#1C2B1C]">{zone.title}</h3>
                <p className="text-[11px] text-[#5A6D5A] mt-1 leading-relaxed">{zone.subtitle}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#F0F4F0] flex items-center justify-between text-[10px] text-[#1B5E20] font-semibold">
                <span>Destino: {zone.targetCollection}</span>
                <span className="text-[9px] text-[#5A6D5A] font-normal">
                  Aba {zone.sheetIndex + 1}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* DROP ZONE ATIVA & CARREGADOR */}
      <Card className="rounded-2xl border-[#DCE5DC] bg-white shadow-sm p-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const files = e.dataTransfer.files
            if (files && files[0]) handleFileChange(files[0])
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[#DCE5DC] hover:border-[#1B5E20] bg-[#F5F7F1]/50 hover:bg-emerald-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center"
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv,.txt,.tsv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0])
              }
            }}
          />

          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-[#1B5E20] flex items-center justify-center mb-3 shadow-inner">
            <UploadCloud className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-[#1C2B1C]">
            Arraste ou clique para selecionar a planilha ({activeZone.title})
          </h4>
          <p className="text-xs text-[#5A6D5A] mt-1 max-w-md">
            Formatos aceitos nativamente: <strong>.xlsx (Excel)</strong> com múltiplas abas ou{' '}
            <strong>.csv</strong> delimitado.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[11px] text-[#5A6D5A] border border-[#DCE5DC]">
            <FileText className="w-3.5 h-3.5 text-[#1B5E20]" />
            <span>Colunas identificadas por aproximação e mapeamento canônico oficial</span>
          </div>
        </div>

        {/* Mensagem de Erro ou Alerta */}
        {validationError && (
          <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Aviso no processamento do arquivo:</p>
              <p className="mt-0.5 leading-relaxed">{validationError}</p>
            </div>
          </div>
        )}

        {/* Seletor de Abas para arquivos XLSX com mais de 1 aba */}
        {availableSheets.length > 1 && (
          <div className="mt-5 p-4 rounded-xl bg-[#F5F7F1] border border-[#DCE5DC] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1C2B1C]">
              <Layers className="w-4 h-4 text-[#1B5E20]" />
              <span>Abas detectadas no arquivo Excel:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableSheets.map((sheet, sIdx) => {
                const isCurrent = sheet === selectedSheet
                return (
                  <Button
                    key={sIdx}
                    variant={isCurrent ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSheetChange(sheet)
                    }}
                    className={`text-xs h-7 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-[#1B5E20] text-white hover:bg-[#2E7D32]'
                        : 'bg-white text-[#1C2B1C] border-[#DCE5DC] hover:border-emerald-300'
                    }`}
                  >
                    <span>{sheet}</span>
                    {sIdx === activeZone.sheetIndex && (
                      <span className="ml-1 text-[10px] opacity-80">(Sugerida)</span>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        {/* Arquivo Carregado e Ações */}
        {fileName && parsedData && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#1B5E20]" />
                <div>
                  <h5 className="font-bold text-xs text-[#1C2B1C]">
                    {fileName} {selectedSheet ? `(Aba: "${selectedSheet}")` : ''}
                  </h5>
                  <p className="text-[11px] text-[#5A6D5A]">
                    {parsedData.rows.length} registros identificados • {parsedData.headers.length}{' '}
                    colunas mapeadas
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <Button
                  onClick={handleExecutarImportacao}
                  disabled={importing}
                  className="bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl text-xs font-semibold px-5 h-10 shadow-md flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Importando ({progress}%)...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirmar e Importar no Banco</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs text-amber-700 bg-amber-50 border-amber-300 py-1.5 px-3"
                  >
                    Modo Somente Leitura (Apenas Admin pode importar)
                  </Badge>
                </div>
              )}
            </div>

            {/* Barra de Progresso durante a carga */}
            {importing && (
              <div className="space-y-1.5 animate-in fade-in">
                <div className="flex justify-between text-xs text-[#5A6D5A]">
                  <span>Gravando registros no PocketBase com controle de vazão...</span>
                  <span className="font-bold text-[#1B5E20]">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 rounded-full [&>div]:bg-[#1B5E20]" />
              </div>
            )}

            {/* RELATÓRIO DE EXECUÇÃO DETALHADO POR MOTIVO DE ERRO */}
            {importSummary && (
              <div className="p-5 rounded-2xl bg-white border border-[#DCE5DC] shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F0F4F0] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />
                    <div>
                      <h4 className="font-bold text-sm text-[#1C2B1C]">
                        Relatório Detalhado de Importação
                      </h4>
                      <p className="text-[11px] text-[#5A6D5A]">
                        Concluído na coleção própria{' '}
                        <code className="bg-[#F5F7F1] px-1.5 py-0.5 rounded text-[#1B5E20]">
                          {activeZone.targetCollection}
                        </code>
                      </p>
                    </div>
                  </div>

                  {importSummary.erros.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportarErrosCsv}
                      className="text-xs h-8 rounded-xl border-[#DCE5DC] text-[#1C2B1C] hover:bg-emerald-50 hover:text-[#1B5E20] hover:border-emerald-300 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Linhas com Erro (.CSV)</span>
                    </Button>
                  )}
                </div>

                {/* Cards de Métricas */}
                {(() => {
                  const duplicadasEntradas = Object.entries(
                    importSummary.duplicadasNoLote || {},
                  ).filter(([, count]) => count > 1)
                  const totalLinhasDuplicadasPlanilha = duplicadasEntradas.reduce(
                    (acc, [, count]) => acc + (count - 1),
                    0,
                  )
                  const totalChavesDuplicadas = duplicadasEntradas.length

                  // Contadores precisos retornados pelo backend
                  // Se o backend retornou atualizadosIntraLote ou atualizadosPreExistentes, usamos direto
                  const temContadorSeparado =
                    importSummary.atualizadosIntraLote !== undefined ||
                    importSummary.atualizadosPreExistentes !== undefined

                  const duplicadasNoArquivo = temContadorSeparado
                    ? (importSummary.atualizadosIntraLote ?? 0) > 0
                      ? importSummary.atualizadosIntraLote!
                      : totalLinhasDuplicadasPlanilha
                    : totalLinhasDuplicadasPlanilha

                  const atualizadosPreExistentes = temContadorSeparado
                    ? (importSummary.atualizadosPreExistentes ?? 0)
                    : Math.max(0, (importSummary.atualizados ?? 0) - duplicadasNoArquivo)

                  const temPreExistentes = atualizadosPreExistentes > 0
                  const temDuplicadasPlanilha = totalChavesDuplicadas > 0 || duplicadasNoArquivo > 0

                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200">
                          <span className="block text-[11px] text-emerald-700 font-medium">
                            Novos Inseridos
                          </span>
                          <strong className="text-xl font-bold text-emerald-800">
                            {importSummary.inseridos}
                          </strong>
                          <span className="block text-[10px] text-emerald-600 mt-0.5">
                            Registros inéditos gravados
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-xl border ${
                            temDuplicadasPlanilha
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`block text-[11px] font-medium ${
                              temDuplicadasPlanilha ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            Duplicadas na Planilha
                          </span>
                          <strong
                            className={`text-xl font-bold ${
                              temDuplicadasPlanilha ? 'text-amber-800' : 'text-slate-700'
                            }`}
                          >
                            {duplicadasNoArquivo}
                          </strong>
                          <span
                            className={`block text-[10px] mt-0.5 ${
                              temDuplicadasPlanilha ? 'text-amber-600' : 'text-slate-500'
                            }`}
                          >
                            {totalChavesDuplicadas > 0
                              ? `${totalChavesDuplicadas} ${
                                  totalChavesDuplicadas === 1
                                    ? 'chave repetida'
                                    : 'chaves repetidas'
                                } • vale a última`
                              : 'Nenhuma chave repetida no arquivo'}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-xl border ${
                            temPreExistentes
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className={`block text-[11px] font-medium ${
                              temPreExistentes ? 'text-blue-700' : 'text-slate-500'
                            }`}
                          >
                            Atualizados Pré-Existentes
                          </span>
                          <strong
                            className={`text-xl font-bold ${
                              temPreExistentes ? 'text-blue-800' : 'text-slate-700'
                            }`}
                          >
                            {atualizadosPreExistentes}
                          </strong>
                          <span
                            className={`block text-[10px] mt-0.5 ${
                              temPreExistentes ? 'text-blue-600' : 'text-slate-500'
                            }`}
                          >
                            {temPreExistentes
                              ? 'Já existiam na base antes'
                              : '0 registros prévios alterados'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 text-slate-900 border border-slate-200">
                          <span className="block text-[11px] text-slate-700 font-medium">
                            {importSummary.erros.length > 0
                              ? 'Erros / Linhas Recusadas'
                              : 'Linhas Recusadas / Ignoradas'}
                          </span>
                          <strong
                            className={`text-xl font-bold ${
                              importSummary.erros.length > 0 ? 'text-red-800' : 'text-slate-800'
                            }`}
                          >
                            {importSummary.erros.length}
                          </strong>
                          <span className="block text-[10px] text-slate-600 mt-0.5">
                            {importSummary.erros.length === 0
                              ? '0 perdas • 100% gravado'
                              : 'Ver diagnóstico abaixo'}
                          </span>
                        </div>
                      </div>

                      {/* Detalhamento e Listagem das Chaves Duplicadas na Planilha */}
                      {totalChavesDuplicadas > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-amber-900">
                                Transparência de Duplicadas na Planilha (Intra-Arquivo):
                              </p>
                              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                                {activeZone.targetCollection === 'simulador_produtos' ? (
                                  <>
                                    Identificação por chave <strong>Código + Embalagem</strong>. As{' '}
                                    {totalChavesDuplicadas} chaves abaixo aparecem mais de uma vez
                                    na planilha enviada. O sistema realiza o upsert idempotente
                                    mantendo 1 registro único no banco com os dados da{' '}
                                    <strong>última ocorrência</strong> (garantindo{' '}
                                    <strong>0 perdas</strong> de produtos distintos).
                                  </>
                                ) : (
                                  <>
                                    A chave identificadora aparece repetida na planilha enviada. O
                                    sistema manteve uma única ocorrência no banco com os dados mais
                                    recentes da última linha (upsert idempotente).
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="pt-1.5 border-t border-amber-200/60 flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-amber-900">
                              {activeZone.targetCollection === 'simulador_produtos'
                                ? `Chaves repetidas na planilha [Código | Embalagem] (${totalChavesDuplicadas}):`
                                : `Chaves repetidas identificadas (${totalChavesDuplicadas}):`}
                            </span>
                            {duplicadasEntradas.slice(0, 20).map(([itemKey, count]) => (
                              <Badge
                                key={itemKey}
                                variant="outline"
                                className="bg-white text-amber-900 border-amber-300 font-mono text-[10px] px-2 py-0.5"
                              >
                                {itemKey}{' '}
                                <span className="text-amber-600 ml-1 font-sans font-bold">
                                  ({count}x)
                                </span>
                              </Badge>
                            ))}
                            {duplicadasEntradas.length > 20 && (
                              <span className="text-[10px] text-amber-700">
                                + {duplicadasEntradas.length - 20} outras
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Resumo por Categoria de Erro (Chips clicáveis) */}
                {Object.keys(importSummary.resumoCategorias).length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs text-[#5A6D5A]">
                      <span className="font-semibold text-[#1C2B1C]">
                        Diagnóstico por Categoria (clique para filtrar):
                      </span>
                      {selectedCategoryFilter && (
                        <button
                          onClick={() => setSelectedCategoryFilter(null)}
                          className="text-[11px] text-[#1B5E20] hover:underline"
                        >
                          Limpar filtro (ver todos)
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(importSummary.resumoCategorias).map(([cat, qtd]) => {
                        const isFiltered = selectedCategoryFilter === cat
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategoryFilter(isFiltered ? null : cat)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                              isFiltered
                                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                                : 'bg-red-50 text-red-900 border border-red-200 hover:bg-red-100'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span className="font-semibold">{cat}:</span>
                            <span className="bg-white/80 text-red-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                              {qtd} {qtd === 1 ? 'linha' : 'linhas'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Tabela Interativa de Linhas com Erro */}
                {errosFiltrados.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#F0F4F0]">
                    <div className="flex items-center justify-between text-xs text-[#5A6D5A]">
                      <span className="font-semibold text-[#1C2B1C]">
                        Detalhamento das Linhas Problemáticas ({errosFiltrados.length} exibidas):
                      </span>
                      <span className="text-[11px]">
                        Clique na linha para expandir os dados brutos
                      </span>
                    </div>

                    <div className="border border-red-200 rounded-xl overflow-hidden text-[11px]">
                      <ScrollableTable autoFitHeight={false} maxHeight="260px" minHeight="160px">
                        <table className="w-full text-left">
                          <thead className="sticky top-0 z-20 bg-red-50 border-b border-red-200 text-red-900 shadow-[0_1px_0_0_#fecaca]">
                            <tr>
                              <th className="py-2 px-3 font-semibold w-16">Linha</th>
                              <th className="py-2 px-3 font-semibold">Categoria</th>
                              <th className="py-2 px-3 font-semibold">Motivo da Recusa</th>
                              <th className="py-2 px-3 font-semibold">Campo / Valor</th>
                              <th className="py-2 px-2 text-center w-8"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100 bg-white">
                            {errosFiltrados.map((item, errIdx) => {
                              const isExpanded = expandedErrorRow === errIdx
                              return (
                                <React.Fragment key={errIdx}>
                                  <tr
                                    onClick={() => setExpandedErrorRow(isExpanded ? null : errIdx)}
                                    className="hover:bg-red-50/40 cursor-pointer transition-colors"
                                  >
                                    <td className="py-2 px-3 font-mono font-bold text-red-700">
                                      {item.linhaOriginal}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-red-900">
                                      {item.categoria}
                                    </td>
                                    <td className="py-2 px-3 text-red-800">{item.motivo}</td>
                                    <td
                                      className="py-2 px-3 text-red-700 max-w-[260px]"
                                      title={
                                        item.campo
                                          ? `${item.campo}: ${item.valor || 'vazio'}`
                                          : item.motivo
                                      }
                                    >
                                      {item.campo && (
                                        <div className="mb-0.5">
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] px-1.5 py-0 border-red-300 text-red-800 bg-red-50/50 font-mono"
                                          >
                                            {item.campo}
                                          </Badge>
                                        </div>
                                      )}
                                      {item.valor ? (
                                        <span
                                          className="font-mono text-[10px] text-red-600 block truncate"
                                          title={item.valor}
                                        >
                                          {item.valor}
                                        </span>
                                      ) : (
                                        <span className="text-red-400 italic text-[10px]">
                                          {item.campo ? 'valor não especificado' : '—'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-center text-red-500">
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr className="bg-[#F5F7F1]">
                                      <td colSpan={5} className="p-3 text-[10px] text-[#1C2B1C]">
                                        <div className="font-semibold text-[#1B5E20] mb-1">
                                          Conteúdo bruto extraído da Linha {item.linhaOriginal}:
                                        </div>
                                        <pre className="bg-white p-2 rounded-lg border border-[#DCE5DC] overflow-x-auto text-xs font-mono">
                                          {JSON.stringify(item.dados, null, 2)}
                                        </pre>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </ScrollableTable>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Preview das primeiras 10 linhas identificadas */}
            <div className="space-y-2 pt-2">
              <h5 className="font-bold text-xs text-[#1C2B1C] flex items-center justify-between">
                <span>Pré-visualização do Mapeamento (10 primeiras linhas de dados)</span>
                <span className="text-[11px] text-[#5A6D5A] font-normal">
                  Total de colunas: {parsedData.headers.length}
                </span>
              </h5>
              <div className="border border-[#DCE5DC] rounded-xl overflow-hidden">
                <ScrollableTable autoFitHeight={false} maxHeight="300px" minHeight="200px">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 z-20 bg-[#F5F7F1] shadow-[0_1px_0_0_#DCE5DC]">
                      <tr className="bg-[#F5F7F1] border-b border-[#DCE5DC] text-left text-[#5A6D5A]">
                        <th className="py-2 px-3 font-semibold text-center w-12">#</th>
                        {parsedData.headers.map((h, i) => (
                          <th key={i} className="py-2 px-3 font-semibold whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F4F0]">
                      {parsedData.rows.slice(0, 10).map((r, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-[#F5F7F1]/40">
                          <td className="py-1.5 px-3 text-center text-[#5A6D5A] font-mono text-[10px]">
                            {parsedData.rowIndices?.[rowIdx] ?? rowIdx + 2}
                          </td>
                          {parsedData.headers.map((h, colIdx) => (
                            <td
                              key={colIdx}
                              className="py-1.5 px-3 max-w-[220px] truncate text-[#1C2B1C]"
                              title={r[h] || ''}
                            >
                              {r[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default Importador
