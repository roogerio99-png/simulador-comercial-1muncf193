import { ItemSimulacaoSalva } from '@/types/simulador'

const STORAGE_KEY = 'simulador_comercial_simulacoes'

export const simulacoesStorage = {
  listar(): ItemSimulacaoSalva[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as ItemSimulacaoSalva[]
    } catch {
      return []
    }
  },

  salvar(item: ItemSimulacaoSalva): void {
    const list = this.listar()
    const semMesmoId = list.filter((it) => it.id !== item.id)
    const atualizado = [item, ...semMesmoId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizado))
  },

  remover(id: string): void {
    const list = this.listar()
    const filtrado = list.filter((it) => it.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtrado))
  },

  limparTodas(): void {
    localStorage.removeItem(STORAGE_KEY)
  },
}
