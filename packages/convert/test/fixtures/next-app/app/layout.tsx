import type { ReactNode } from 'react'
import './globals.css'
import { Header } from '../components/header'

export const metadata = { title: 'Acme store', description: 'Order fresh groceries online' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <Header />
        <main className="mx-auto max-w-3xl p-6">{children}</main>
      </body>
    </html>
  )
}
