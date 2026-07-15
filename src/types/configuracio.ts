import type { Rol } from './db'

/** Usuari del tenant, tal com es mostra a la Gestió d'Usuaris. */
export type UsuariTenant = {
  id: number
  nom: string
  email: string
  rol: Rol
  actiu: boolean
  darrerAcces: string | null
  creatEl: string
}

/** Raça del catàleg, distingint les globals (protegides) de les pròpies del tenant. */
export type RacaCataleg = {
  id: number
  nomRaca: string
  esGlobal: boolean
}

/** Configuració general del tenant (llindars d'estoc per defecte). */
export type ConfiguracioGeneral = {
  estocMinimDefaultKg: number
  estocMinimDefaultTones: number
}
