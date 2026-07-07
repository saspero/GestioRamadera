import { Pool, PoolClient } from 'pg'

if (!process.env.DATABASE_URL) {
  throw new Error('Variable d\'entorn DATABASE_URL no definida')
}

// Pool de connexions reutilitzat entre invocacions serverless
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,                    // Màxim connexions per instància serverless
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export type Rol = 'Admin' | 'Veterinari' | 'Treballador'

export type TenantContext = {
  tenantSchema: string
  userId: number
  rol: Rol
}

/**
 * Executa una query dins del schema del tenant correcte.
 * Usa SET LOCAL search_path per garantir l'aïllament per transacció.
 * Cap dada d'un tenant pot ser accessible des d'un altre.
 */
export async function queryTenant<T = Record<string, unknown>>(
  ctx: TenantContext,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client: PoolClient = await pool.connect()
  try {
    // SET LOCAL afecta només aquesta transacció, no la connexió del pool
    await client.query(
      `SET LOCAL search_path TO ${client.escapeIdentifier(ctx.tenantSchema)}, public`
    )
    const result = await client.query<T>(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Executa una query al schema públic (tenants, users, audit_log).
 * Usar únicament per a operacions globals (login, aprovisionament).
 */
export async function queryPublic<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client: PoolClient = await pool.connect()
  try {
    const result = await client.query<T>(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Registra una acció a l'audit_log.
 * Cridar des de totes les operacions crítiques.
 */
export async function auditLog(params: {
  tenantId: number
  userId: number
  accio: string
  taulaAfectada?: string
  registreId?: number
  dadesJson?: Record<string, unknown>
  ipOrigen?: string
}): Promise<void> {
  await queryPublic(
    `INSERT INTO public.audit_log
      (tenant_id, user_id, accio, taula_afectada, registre_id, dades_json, ip_origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.tenantId,
      params.userId,
      params.accio,
      params.taulaAfectada ?? null,
      params.registreId ?? null,
      params.dadesJson ? JSON.stringify(params.dadesJson) : null,
      params.ipOrigen ?? null,
    ]
  )
}
