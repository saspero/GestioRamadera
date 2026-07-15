'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Rol } from '@/types/db'

type ModalNouUsuariProps = {
  onTancar: () => void
  onCreat: () => void
}

/**
 * Modal de creació d'un usuari nou per al tenant.
 *
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onCreat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari de nom, email, contrasenya i rol
 *
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Configuració, ja protegida per a Admin. L'endpoint
 * torna a validar el rol igualment.
 */
export function ModalNouUsuari({ onTancar, onCreat }: ModalNouUsuariProps) {
  const queryClient = useQueryClient()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<Rol>('Treballador')

  const potConfirmar = nom.trim() !== '' && email.trim() !== '' && password.length >= 8

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/configuracio/usuaris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nom.trim(), email: email.trim(), password, rol }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear l\'usuari')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracio.usuaris })
      toastExit('Usuari creat correctament')
      onCreat()
    },
    onError: (err) => toastError(err, 'Error en crear l\'usuari'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Crear usuari"
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol="Nou usuari" onTancar={onTancar} peu={peu}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contrasenya *</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
          <p className="text-xs text-gray-400 mt-1">Mínim 8 caràcters.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as Rol)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          >
            <option value="Admin">Admin</option>
            <option value="Veterinari">Veterinari</option>
            <option value="Treballador">Treballador</option>
          </select>
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
