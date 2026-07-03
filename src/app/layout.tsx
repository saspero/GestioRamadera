import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Gestió Ramadera',
    template: '%s | Gestió Ramadera',
  },
  description: 'Plataforma de gestió integral d\'explotacions bovines',
  // PWA — no indexar (aplicació privada de gestió)
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Evita zoom accidental a peu de granja
  themeColor: '#16a34a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  )
}
