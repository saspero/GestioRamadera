import { queryPublic } from '@/lib/db/client'

const FINESTRA_MINUTS = 15
const MAX_INTENTS      = 5

export type RateLimitResult = {
  bloquejat: boolean
  motiu?: 'IP' | 'EMAIL'
}

/**
 * Comprova si un email o una IP ha superat el límit d'intents fallits
 * de login en els darrers 15 minuts. Bloqueja si qualsevol dels dos
 * (email o IP) supera el límit — el que salti primer.
 */
export async function comprovarRateLimit(
  email: string,
  ipOrigen: string
): Promise<RateLimitResult> {
  const rows = await queryPublic<{ intents_email: string; intents_ip: string }>(
    `SELECT
      (SELECT COUNT(*) FROM public.login_attempts
        WHERE email = $1
          AND exit = FALSE
          AND creat_el > NOW() - INTERVAL '${FINESTRA_MINUTS} minutes'
      ) AS intents_email,
      (SELECT COUNT(*) FROM public.login_attempts
        WHERE ip_origen = $2::inet
          AND exit = FALSE
          AND creat_el > NOW() - INTERVAL '${FINESTRA_MINUTS} minutes'
      ) AS intents_ip
    `,
    [email, ipOrigen]
  )

  const { intents_email, intents_ip } = rows[0]

  if (Number(intents_ip) >= MAX_INTENTS) {
    return { bloquejat: true, motiu: 'IP' }
  }
  if (Number(intents_email) >= MAX_INTENTS) {
    return { bloquejat: true, motiu: 'EMAIL' }
  }
  return { bloquejat: false }
}

/**
 * Registra un intent de login (èxit o fracàs) a login_attempts.
 * Cridar SEMPRE després de cada intent, independentment del resultat.
 */
export async function registrarIntent(
  email: string,
  ipOrigen: string,
  exit: boolean
): Promise<void> {
  await queryPublic(
    `INSERT INTO public.login_attempts (email, ip_origen, exit)
     VALUES ($1, $2::inet, $3)`,
    [email, ipOrigen, exit]
  )
}

/**
 * Extreu la IP real del request, tenint en compte el proxy de Vercel.
 */
export function extreureIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for pot contenir una llista "ip1, ip2, ..."; la primera és el client real
    return forwarded.split(',')[0].trim()
  }
  return headers.get('x-real-ip') ?? '0.0.0.0'
}
