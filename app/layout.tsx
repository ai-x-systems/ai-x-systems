import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const _inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI x Systems — AI Receptionists & Chatbots for Local Businesses',
  description:
    'AI receptionists and website chatbots that answer customers 24/7, qualify leads, and book appointments automatically. Get a free personalized demo for your business.',
  generator: 'v0.app',
  keywords: [
    'AI receptionist',
    'AI phone answering',
    'AI chatbot',
    'appointment booking automation',
    'missed call recovery',
  ],
  openGraph: {
    title: 'AI x Systems — Never Miss Another Customer Call',
    description:
      'AI receptionists and website chatbots that answer customers 24/7, qualify leads, and book appointments automatically.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0f0f10',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
