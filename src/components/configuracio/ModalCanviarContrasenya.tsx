'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type ModalCanviarContrasenyaProps = {
  usuariId: number
  usuariEmail: string
  onTancar: () => void
  onCanviada: () => void
}

/**
 * Modal per canviar la contrasenya d'un usuari del tenant.
 *
 * @param props.usuariId - Id de l'usuari
 * @param props.usuariEmail - Email de l'usuari, per al títol del modal
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onCanviada - Callback en confirmar amb èxit
 * @returns Modal amb el camp de nova contrasenya
 *
 * @remarks No invalida cap query en tenir èxit — canviar una
 * contrasenya no altera cap dada visible a la taula d'usuaris.
 * @remarks Control d'accés: Admin únicament.
 */
export function ModalCanviarContrasenya({
  usuariId,
  usuariEmail,
  onTancar,
  onCanviada,
}: ModalCanviarContrasenyaProps) {
  const [password, setPassword] = useState('')

  const potConfirmar = password.length >= 8

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/configuracio/usuaris/${usuariId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en canviar la contrasenya')
      return json
    },
    onSuccess: () => {
      toastExit('Contrasenya actualitzada')
      onCanviada()
    },
    onError: (err) => toastError(err, 'Error en canviar la contrasenya'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Canviar contrasenya"
      textEnviant="Desant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol={`Canviar contrasenya — ${usuariEmail}`} onTancar={onTancar} mida="sm" peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contrasenya nova *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
          <p className="text-xs text-gray-400 mt-1">Mínim 8 caràcters.</p>
        </div>

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </form>
    </Modal>
  )
}
