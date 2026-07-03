import type { Rol } from './db'

export type SessionPayload = {
  sub:          string   // userId com a string (estàndard JWT)
  tenantId:     number
  tenantSchema: string
  rol:          Rol
  iat:          number
  exp:          number
}
