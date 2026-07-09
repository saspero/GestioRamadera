/**
 * Formata un número seguint la convenció numèrica del projecte:
 * separador decimal amb coma i separador de milers amb punt
 * (Ex: 1.234,56), tal com estableix docs/README.md.
 *
 * @param valor - Número a formatar
 * @param decimals - Nombre de decimals a mostrar (per defecte 0)
 * @returns Cadena formatada segons la convenció catalana
 *
 * @remarks Utilitza Intl.NumberFormat amb locale 'ca-ES', que ja
 * aplica coma decimal i punt de milers nativament.
 */
export function formatNumber(valor: number, decimals = 0): string {
  return new Intl.NumberFormat('ca-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(valor)
}

/**
 * Formata una data ISO (AAAA-MM-DD) al format de visualització DD/MM/AAAA.
 *
 * @param dataIso - Data en format ISO (Ex: '2026-07-09')
 * @returns Data formatada (Ex: '09/07/2026')
 */
export function formatDate(dataIso: string): string {
  const [any, mes, dia] = dataIso.split('-')
  return `${dia}/${mes}/${any}`
}
