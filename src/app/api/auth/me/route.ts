import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/auth/me
 *
 * Retorna l'id de l'usuari amb la sessió activa.
 *
 * @remarks Creat específicament per a la pantalla de Gestió
 * d'Usuaris (Configuració), que necessita saber quin usuari de la
 * llista és "jo mateix" per desactivar els controls que permetrien
 * un autobloqueig (desactivar-se o treure's el rol d'Admin a un
 * mateix). SessioContext (src/lib/session/SessioContext.tsx) només
 * exposa `rol` i `nom`, no l'id — en comptes de tocar el layout
 * arrel (Server Component que decodifica el JWT) per afegir-hi
 * l'id sense poder-ne verificar el contingut actual, es crea aquest
 * endpoint autocontingut que reaprofita la capçalera `x-user-id` que
 * el middleware ja injecta a totes les peticions.
 * @remarks Control d'accés: qualsevol usuari autenticat (no exposa
 * cap dada sensible, només el seu propi id).
 */
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  return NextResponse.json({ userId: Number(userId) })
}
