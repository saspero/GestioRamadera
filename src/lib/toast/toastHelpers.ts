import { toast } from 'sonner'

/**
 * Emet un toast d'èxit amb el missatge indicat.
 *
 * @param missatge - Text a mostrar (en català, veu activa: "Animal creat")
 */
export function toastExit(missatge: string): void {
  toast.success(missatge)
}

/**
 * Emet un toast d'error, extraient el missatge d'un Error o
 * fent servir un text per defecte si no se'n pot extreure cap.
 *
 * @param error - Error capturat (d'un catch, o el resultat d'un fetch fallit)
 * @param missatgePerDefecte - Text a mostrar si `error` no és una instància d'Error
 *
 * @remarks Centralitza el patró `err instanceof Error ? err.message : ...`
 * que es repetia a cada modal del projecte — a partir d'aquest
 * lliurament, els formularis migrats criden aquesta funció en comptes
 * de gestionar l'error localment amb un estat `errorMsg` propi.
 */
export function toastError(error: unknown, missatgePerDefecte = 'Hi ha hagut un error'): void {
  const missatge = error instanceof Error ? error.message : missatgePerDefecte
  toast.error(missatge)
}
