'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Rol } from '@/types/db'
import type { UsuariTenant } from '@/types/configuracio'

type ModalEditarUsuariProps = {
  usuari: UsuariTenant
  /** True si l'usuari editat és el mateix que ha iniciat sessió — bloqueja desactivar-se/degradar-se. */
  esUnMateix: boolean
  onTancar: () => void
  onDesat: () => void
}

/**
 * Modal d'edició d'un usuari existent: nom, rol i estat actiu.
 * El canvi de contrasenya és una acció separada (ModalCanviarContrasenya).
 *
 * @param props.usuari - Usuari a editar
 * @param props.esUnMateix - Si true, es desactiven els controls que
 * permetrien un autobloqueig (desactivar-se o deixar de ser Admin)
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onDesat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari d'edició
 *
 * @remarks L'endpoint torna a validar la protecció d'autobloqueig
 * igualment — aquesta comprovació al client és només per estalviar
 * un viatge d'anada i tornada innecessari.
 * @remarks Control d'accés: Admin únicament.
 */
export function ModalEditarUsuari({ usuari, esUnMateix, onTancar, onDesat }: ModalEditarUsuariProps) {
  const queryClient = useQueryClient()
  const [nom, setNom] = useState(usuari.nom)
  const [rol, setRol] = useState<Rol>(usuari.rol)
  const [actiu, setActiu] = useState(usuari.actiu)

  const potConfirmar = nom.trim() !== ''

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/configuracio/usuaris/${usuari.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim(), rol, actiu }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar l\'usuari')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracio.usuaris })
      toastExit('Usuari actualitzat')
      onDesat()
    },
    onError: (err) => toastError(err, 'Error en desar l\'usuari'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Desar"
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol={`Editar usuari — ${usuari.email}`} onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            disabled={mutacio.isPending || esUnMateix}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base disabled:bg-gray-100"
          >
            <option value="Admin">Admin</option>
            <option value="Veterinari">Veterinari</option>
            <option value="Treballador">Treballador</option>
          </select>
          {esUnMateix && (
            <p className="text-xs text-gray-400 mt-1">No et pots canviar el rol a tu mateix.</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={actiu}
            onChange={(e) => setActiu(e.target.checked)}
            disabled={mutacio.isPending || esUnMateix}
          />
          Actiu
          {esUnMateix && (
            <span className="text-xs text-gray-400">(no et pots desactivar a tu mateix)</span>
          )}
        </label>

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </form>
    </Modal>
  )
}
