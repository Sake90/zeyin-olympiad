import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZEYIN-ZOOTOPIA OLIMPYAD',
  description: 'ZEYIN oqu ortalygy — онлайн-олимпиада',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
