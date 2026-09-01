import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'

/*
  design.md names 'Cal Sans' and 'Cal Sans UI Variable Light', neither of which
  is publicly distributable. It supplies substitutes for exactly this case:
  Poppins for the geometric display face, Inter Light for body and UI.
*/
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['600'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Async School',
  description: 'School management for Async Tech Solutions',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
