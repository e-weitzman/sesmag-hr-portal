'use client'
// src/components/Providers.js
import { AuthProvider } from '@/hooks/useAuth'

export default function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>
}
