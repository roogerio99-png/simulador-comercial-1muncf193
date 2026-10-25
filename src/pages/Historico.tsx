import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock,
  Trash2,
  ExternalLink,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calculator,
  Search,
} from 'lucide-react'
import { simulacoesStorage } from '@/lib/simulacoesStorage'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ItemSimulacaoSalva } from '@/types/simulador'

export function Historico() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [simulacoes, setSimulacoes] = useState<ItemSimulacaoSalva[]>([])
  const [busca, setBusca] = useState('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemSimulacaoSalva | null>(null)

  const carregar = () => {
    const list = simulacoesStorage.listar()
    setSimulacoes(list)
  }

  useEffect(() => {
    carregar()
  }, [])

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  const formatData = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR')
    } catch {
      return iso
    }
  }

  const handleExcluirConfirmado = () => {
    if (!itemParaExcluir) return
    simulacoesStorage.remover(itemParaExcluir.id)
    setItemParaExcluir(null)
    carregar()
    toast({
      title: 'Simulação excluída',
      description: 'O registro foi removido do seu histórico local.',
    })
  }

  const handleExportarCsv = (s: ItemSimulacaoSalva) => {
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
      'Frete',
      'ICMS_Total',
      'PIS_Total',
      'COFINS_Total',
      'IBS_Total',
      'CBS_Total',
      'Preco_Final_Total',
    ]

    const data = [
      formatData(s.data),
      `"${s.produtoDescricao}"`,
      `"${s.produtoCodigo || ''}"`,
      `"${s.ncm}"`,
      s.ufOrigem,
      s.ufDestino,
      s.quantidade,
      s.precoBaseUnitario,
      s.margemLucroPerc,
      s.frete,
      s.valorIcmsTotal,
      s.valorPisTotal,
      s.valorCofinsTotal,
      s.valorIbsTotal,
      s.valorCbsTotal,
      s.precoFinalTotal,
    ]

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), data.join(',')].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `simulacao_${s.produtoCodigo || 'salva'}_${s.id}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Planilha exportada!',
      description: 'Download do arquivo CSV concluído.',
    })
  }

  const filtradas = simulacoes.filter((s) => {
    const termo = busca.toLowerCase()
    return (
      s.produtoDescricao.toLowerCase().includes(termo) ||
      (s.produtoCodigo && s.produtoCodigo.toLowerCase().includes(termo)) ||
      s.ncm.toLowerCase().includes(termo) ||
      s.ufOrigem.toLowerCase().includes(termo) ||
      s.ufDestino.toLowerCase().includes(termo)
    )
  })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E4EAE5]">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[#1E2A24] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#1D6A43]" />
            Histórico de Simulações
          </h1>
          <p className="text-xs md:text-sm text-[#5D6B63] mt-0.5">
            Acesse e compare simulações salvas no seu dispositivo, com detalhamento de custos e
            impostos.
          </p>
        </div>

        {simulacoes.length > 0 && (
          <Button
            onClick={() => navigate('/simulate')}
            className="h-8 gap-1.5 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white"
          >
            <Calculator className="w-3.5 h-3.5" />
            Nova Simulação
          </Button>
        )}
      </div>

      {simulacoes.length === 0 ? (
        /* Estado Vazio */
        <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#E6F2EC] flex items-center justify-center text-[#1D6A43] mx-auto">
              <Calculator className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-[#1E2A24]">Nenhuma simulação salva ainda</h3>
            <p className="text-xs text-[#5D6B63]">
              Faça sua primeira simulação de preço com cálculo de ICMS e markups para salvá-la aqui.
            </p>
            <Button
              onClick={() => navigate('/simulate')}
              className="bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs gap-2"
            >
              <Calculator className="w-4 h-4" />
              Fazer uma Simulação Agora
            </Button>
          </div>
        </Card>
      ) : (
        /* Lista de Simulações Salvas */
        <div className="space-y-4">
          <Card className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm p-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por descrição, código, NCM ou UFs..."
                className="pl-9 text-xs h-9 border-[#E4EAE5]"
              />
            </div>
          </Card>

          <div className="space-y-3">
            {filtradas.map((s) => {
              const isExpandido = expandidoId === s.id
              return (
                <Card
                  key={s.id}
                  className="rounded-2xl border-[#E4EAE5] bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <CardHeader className="p-4 bg-[#FAFBF9] border-b border-[#E4EAE5]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#1D6A43] text-white font-mono text-[10px]">
                          {s.produtoCodigo || 'AVULSO'}
                        </Badge>
                        <span className="font-semibold text-xs text-[#1E2A24] truncate">
                          {s.produtoDescricao}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[11px] text-[#5D6B63]">{formatData(s.data)}</span>
                        <Badge variant="outline" className="font-mono text-[10px] bg-white">
                          NCM: {s.ncm}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#5D6B63] uppercase">Rota</span>
                        <p className="font-bold text-[#1E2A24]">
                          {s.ufOrigem} → {s.ufDestino}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#5D6B63] uppercase">Volume</span>
                        <p className="font-semibold text-[#1E2A24]">{s.quantidade} unidades</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#5D6B63] uppercase">Preço Unitário</span>
                        <p className="font-bold text-[#C98A2D]">
                          {formatBRL(s.precoFinalUnitario)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#5D6B63] uppercase">
                          Total Consolidado
                        </span>
                        <p className="font-bold text-base text-[#1D6A43]">
                          {formatBRL(s.precoFinalTotal)}
                        </p>
                      </div>
                    </div>

                    {/* Detalhamento Expansível */}
                    {isExpandido && (
                      <div className="pt-3 border-t border-slate-100 space-y-3 text-xs animate-in fade-in">
                        <h4 className="font-semibold text-[#1E2A24]">
                          Detalhamento Tributário & Custos:
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#F7F9F6] p-3 rounded-xl border border-[#E4EAE5]">
                          <div>
                            <span className="text-slate-500 text-[11px]">
                              Base Comercial Total:
                            </span>
                            <p className="font-medium">{formatBRL(s.valorBaseTotal)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">
                              Margem ({s.margemLucroPerc}%):
                            </span>
                            <p className="font-medium">{formatBRL(s.valorMargemTotal)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">Frete:</span>
                            <p className="font-medium">{formatBRL(s.valorFreteTotal)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">
                              ICMS ({s.aliquotaIcms}%):
                            </span>
                            <p className="font-semibold text-amber-900">
                              {formatBRL(s.valorIcmsTotal)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">
                              PIS ({s.aliquotaPis}%):
                            </span>
                            <p className="font-medium">{formatBRL(s.valorPisTotal)}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">
                              COFINS ({s.aliquotaCofins}%):
                            </span>
                            <p className="font-medium">{formatBRL(s.valorCofinsTotal)}</p>
                          </div>
                          {s.incluirIbsCbs && (
                            <>
                              <div>
                                <span className="text-slate-500 text-[11px]">IBS (2027):</span>
                                <p className="font-semibold text-emerald-900">
                                  {formatBRL(s.valorIbsTotal)}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500 text-[11px]">CBS (2027):</span>
                                <p className="font-semibold text-rose-900">
                                  {formatBRL(s.valorCbsTotal)}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ações da Simulação */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandidoId(isExpandido ? null : s.id)}
                        className="h-7 text-xs text-slate-600 gap-1"
                      >
                        {isExpandido ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Ocultar Detalhes
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> Ver Detalhes
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportarCsv(s)}
                          className="h-7 text-xs border-[#E4EAE5] gap-1"
                        >
                          <Download className="w-3.5 h-3.5 text-[#1D6A43]" />
                          CSV
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            navigate(`/simulate?codigo=${s.produtoCodigo || ''}`)
                          }}
                          className="h-7 text-xs bg-[#1D6A43] hover:bg-[#155C36] text-white gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Reabrir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setItemParaExcluir(s)}
                          className="h-7 text-xs text-[#C0392B] hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={Boolean(itemParaExcluir)} onOpenChange={() => setItemParaExcluir(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-[#1E2A24]">
              Confirmar exclusão de simulação
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#5D6B63]">
              Tem certeza de que deseja remover esta simulação salva do seu histórico local? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-8">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluirConfirmado}
              className="bg-[#C0392B] hover:bg-red-800 text-white text-xs h-8"
            >
              Excluir Simulação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Historico
