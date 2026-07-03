import { NextRequest, NextResponse } from 'next/server'
import { queryPublic } from '@/lib/db/client'

/**
 * Endpoint cridat per Vercel Cron (vegeu vercel.json) un cop al dia.
 * Purga els registres de login_attempts de més de 48 hores.
 *
 * Protegit amb CRON_SECRET perquè només Vercel el pugui invocar.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  try {
    const result = await queryPublic<{ fn_purgar_login_attempts: number }>(
      `SELECT public.fn_purgar_login_attempts()`
    )
    const esborrats = result[0]?.fn_purgar_login_attempts ?? 0

    return NextResponse.json({ ok: true, registresEsborrats: esborrats })
  } catch (error) {
    console.error('[GET /api/cron/purge-login-attempts]', error)
    return NextResponse.json({ error: 'Error intern' }, { status: 500 })
  }
}
