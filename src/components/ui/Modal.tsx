'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export type ModalMida = 'sm' | 'md' | 'lg' | 'xl'

const AMPLADES: Record<ModalMida, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
}

type ModalProps = {
  titol: string
  onTancar: () => void
  mida?: ModalMida
  /** Contingut principal, normalment un <form> o una llista/taula. */
  children: React.ReactNode
  /** Botons del peu (normalment Cancel·lar + Confirmar). Si s'omet, no es mostra cap peu. */
  peu?: React.ReactNode
  /**
   * z-index elevat per a modals oberts sobre un altre modal (per
   * exemple, ModalBaixa obert des de dins de FitxaAnimalModal).
   * @default false
   */
  sobreposat?: boolean
}

/**
 * Modal base reutilitzable: overlay, capçalera amb títol i botó de
 * tancar, cos amb scroll intern, i peu opcional per als botons
 * d'acció.
 *
 * @param props.titol - Text de la capçalera
 * @param props.onTancar - Callback per tancar (botó X, tecla Escape, o clic a l'overlay)
 * @param props.mida - Amplada màxima del modal (per defecte 'md')
 * @param props.children - Contingut principal
 * @param props.peu - Botons d'acció del peu, opcional
 * @param props.sobreposat - Si true, augmenta el z-index per obrir-se sobre un altre modal
 * @returns Estructura completa del modal
 *
 * @remarks Substitueix l'esquelet que es repetia manualment a cada
 * modal del projecte (ModalNouLot, ModalGranja, ModalNouMedicament,
 * ModalAplicarTractament...). Els modals migrats a partir d'aquest
 * lliurament l'utilitzen en comptes de reimplementar
 * `fixed inset-0 z-50 flex items-center...` cada vegada.
 * @remarks Tanca amb la tecla Escape per accessibilitat de teclat
 * (funcionalitat que cap modal anterior tenia).
 * @remarks Els modals EXISTENTS (Sanitari, Logística, Granja/Corts,
 * Lots, Animals) NO es migren en aquest lliurament — continuen
 * funcionant amb el seu propi esquelet fins que es reescriguin en un
 * proper lliurament (lliuraments 2 i 3 del pla acordat).
 */
export function Modal({ titol, onTancar, mida = 'md', children, peu, sobreposat = false }: ModalProps) {
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onTancar()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onTancar])

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/50 p-4 ${sobreposat ? 'z-[60]' : 'z-50'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onTancar()
      }}
    >
      <div className={`bg-white rounded-lg shadow-xl w-full ${AMPLADES[mida]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{titol}</h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {peu && <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">{peu}</div>}
      </div>
    </div>
  )
}
