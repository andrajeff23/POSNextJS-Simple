"use client"

import { useState } from "react"
import { useAuth } from "@/components/providers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Store, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"

export function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    const res = await login(email, password)
    setLoading(false)
    if (!res.ok) setError(res.error || "Gagal masuk")
  }

  const fillDemo = (type: "admin" | "kasir") => {
    setEmail(type === "admin" ? "admin@pos.com" : "kasir@pos.com")
    setPassword(type === "admin" ? "admin123" : "kasir123")
    setError("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-teal-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 mb-3">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">POS Kasir Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistem Kasir & Manajemen Inventory</p>
        </div>

        <Card className="shadow-xl border-border/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Masuk ke Akun</CardTitle>
            <CardDescription>Masukkan email dan password untuk melanjutkan</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@pos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Masuk"}
              </Button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-muted-foreground text-center mb-3 flex items-center justify-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Akun Demo
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fillDemo("admin")}
                  className="rounded-lg border bg-muted/50 hover:bg-muted px-3 py-2 text-left transition-colors"
                >
                  <p className="text-xs font-semibold">Admin</p>
                  <p className="text-[10px] text-muted-foreground">admin@pos.com</p>
                </button>
                <button
                  onClick={() => fillDemo("kasir")}
                  className="rounded-lg border bg-muted/50 hover:bg-muted px-3 py-2 text-left transition-colors"
                >
                  <p className="text-xs font-semibold">Kasir</p>
                  <p className="text-[10px] text-muted-foreground">kasir@pos.com</p>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2025 POS Kasir Pro. Semua hak dilindungi.
        </p>
      </div>
    </div>
  )
}
