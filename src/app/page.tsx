"use client"

import { useAuth } from "@/components/providers"
import { LoginScreen } from "@/components/auth/login-screen"
import { AppShell, LoadingScreen } from "@/components/app-shell"

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <LoginScreen />
  return <AppShell />
}
