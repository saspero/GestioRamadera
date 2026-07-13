'use client'

type ModalAccionsProps = {
  onCancelar: () => void
  onConfirmar: () => void
  /** Text del botó de confirmació (per exemple "Crear lot", "Desar", "Confirmar baixa"). */
  textConfirmar: string
  /** Text mostrat mentre `enviant` és true (per exemple "Desant..."). */
  textEnviant?: string
  enviant?: boolean
  disabled?: boolean
  /** Estil vermell per a accions destructives (per exemple donar de baixa). */
  variant?: 'primary' | 'perill'
}

/**
 * Parell de botons estàndard Cancel·lar/Confirmar per al peu d'un Modal.
 *
 * @param props.onCancelar - Callback del botó Cancel·lar
 * @param props.onConfirmar - Callback del botó de confirmació
 * @param props.textConfirmar - Text del botó de confirmació en repòs
 * @param props.textEnviant - Text durant l'enviament (per defecte "Desant...")
 * @param props.enviant - Si true, desactiva els botons i mostra `textEnviant`
 * @param props.disabled - Desactiva el botó de confirmació independentment de `enviant`
 * @param props.variant - 'primary' (per defecte) o 'perill' (vermell, accions destructives)
 * @returns Els dos botons, pensats per passar-se com a `peu` a <Modal>
 */
export function ModalAccions({
  onCancelar,
  onConfirmar,
  textConfirmar,
  textEnviant = 'Desant...',
  enviant = false,
  disabled = false,
  variant = 'primary',
}: ModalAccionsProps) {
  const colorConfirmar =
    variant === 'perill'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-primary-600 hover:bg-primary-700'

  return (
    <>
      <button
        onClick={onCancelar}
        disabled={enviant}
        className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
      >
        Cancel·lar
      </button>
      <button
        onClick={onConfirmar}
        disabled={disabled || enviant}
        className={`px-4 py-2.5 text-white font-medium rounded-lg min-h-[44px]
                    disabled:opacity-50 disabled:cursor-not-allowed ${colorConfirmar}`}
      >
        {enviant ? textEnviant : textConfirmar}
      </button>
    </>
  )
}
