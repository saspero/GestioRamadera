'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type EstatEnviament = 'idle' | 'enviant' | 'error'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [estat, setEstat]       = useState<EstatEnviament>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEstat('enviant')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        // 429 (rate limit) i 401 (credencials) mostren el missatge del servidor
        setErrorMsg(data.error ?? 'Error en iniciar sessió')
        setEstat('error')
        return
      }

      // Login correcte — redirigir al dashboard
      router.push('/dashboard')
      router.refresh()

    } catch {
      setErrorMsg('Error de connexió. Comprova la teva xarxa.')
      setEstat('error')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Gestió Ramadera
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Inicia sessió per continuar
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correu electrònic
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={estat === 'enviant'}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contrasenya
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={estat === 'enviant'}
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={estat === 'enviant'}
            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {estat === 'enviant' ? 'Iniciant sessió...' : 'Iniciar sessió'}
          </button>
        </form>
      </div>
    </main>
  )
}
