import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function Header() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <Link href="/" className="text-lg font-semibold">Acme store</Link>
      <nav className="flex items-center text-left">
        <Link href="/pricing" className="ml-4 flex items-center">
          See pricing
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
        <Link href="/settings" className="ml-4">Settings</Link>
      </nav>
    </header>
  )
}
