'use client'

import { Pencil, KeyRound } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { UsuariTenant } from '@/types/configuracio'

type TaulaUsuarisProps = {
  usuaris: UsuariTenant[]
  carregant: boolean
  usuariActualId: number
  onEditar: (usuari: UsuariTenant) => void
  onCanviarContrasenya: (usuari: UsuariTenant) => void
}

const COLORS_ROL: Record<string, string> = {
  Admin: 'bg-purple-100 text-purple-700',
  Veterinari: 'bg-blue-100 text-blue-700',
  Treballador: 'bg-gray-100 text-gray-700',
}

/**
 * Taula de gestió d'usuaris del tenant.
 *
 * @param props.usuaris - Usuaris a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @param props.usuariActualId - Id de l'usuari amb la sessió activa,
 * per destacar la seva pròpia fila
 * @param props.onEditar - Callback per obrir el modal d'edició
 * @param props.onCanviarContrasenya - Callback per obrir el modal de canvi de contrasenya
 * @returns Taula amb nom, email, rol, estat i darrer accés
 */
export function TaulaUsuaris({
  usuaris,
  carregant,
  usuariActualId,
  onEditar,
  onCanviarContrasenya,
}: TaulaUsuarisProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Nom</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Rol</th>
            <th className="px-4 py-2 font-medium">Estat</th>
            <th className="px-4 py-2 font-medium">Darrer accés</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
          ) : usuaris.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Cap usuari donat d&apos;alta.</td></tr>
          ) : (
            usuaris.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">
                  {u.nom}
                  {u.id === usuariActualId && (
                    <span className="text-xs text-gray-400 ml-1">(tu)</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-700">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS_ROL[u.rol]}`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.actiu ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.actiu ? 'Actiu' : 'Inactiu'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {u.darrerAcces ? formatDate(u.darrerAcces) : '—'}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditar(u)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      aria-label={`Editar ${u.nom}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => onCanviarContrasenya(u)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      aria-label={`Canviar contrasenya de ${u.nom}`}
                    >
                      <KeyRound size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
