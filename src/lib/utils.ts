/* General utility functions (exposes cn) */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class names into a single string
 * @param inputs - Array of class names
 * @returns Merged class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata qualquer número sempre com 2 casas decimais depois da vírgula (padrão pt-BR: 0,00)
 */
export function formatarValor2Casas(valor?: number | string | null): string {
  if (valor === undefined || valor === null || valor === '') return '0,00'
  const num =
    typeof valor === 'number'
      ? valor
      : parseFloat(String(valor).replace(/\./g, '').replace(',', '.'))
  if (isNaN(num)) return '0,00'
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Formata valores monetários (BRL ou USD) sempre com 2 casas decimais depois da vírgula
 */
export function formatarMoeda2Casas(
  valor?: number | string | null,
  moeda: 'BRL' | 'USD' | string = 'BRL',
): string {
  if (valor === undefined || valor === null || valor === '') {
    return moeda === 'USD' ? 'US$ 0,00' : 'R$ 0,00'
  }
  const num =
    typeof valor === 'number'
      ? valor
      : parseFloat(String(valor).replace(/\./g, '').replace(',', '.'))
  if (isNaN(num)) {
    return moeda === 'USD' ? 'US$ 0,00' : 'R$ 0,00'
  }
  const formatado = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return moeda === 'USD' ? `US$ ${formatado}` : `R$ ${formatado}`
}

/**
 * Formata valores percentuais sempre com 2 casas decimais depois da vírgula (ex: 12,50%)
 */
export function formatarPercentual2Casas(valor?: number | string | null): string {
  return `${formatarValor2Casas(valor)}%`
}

