"use client"

import { useState } from "react"
import { ShoppingCart, Package, Boxes, ReceiptText, BarChart3, Store, LogOut, ChevronDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers"
import { useCart } from "@/store/cart"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PosView } from "@/components/views/pos-view"
import { ProductsView } from "@/components/views/products-view"
import { InventoryView } from "@/components/views/inventory-view"
import { SalesView } from "@/components/views/sales-view"
import { ReportsView } from "@/components/views/reports-view"
import { toast } from "sonner"

export type ViewKey = "pos" | "products" | "inventory" | "sales" | "reports"

const navItems: { key: ViewKey; label: string; icon: typeof ShoppingCart }[] = [
  { key: "pos", label: "Kasir", icon: ShoppingCart },
  { key: "products", label: "Produk", icon: Package },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "sales", label: "Penjualan", icon: ReceiptText },
  { key: "reports", label: "Laporan", icon: BarChart3 },
]

export function AppShell() {
  const [view, setView] = useState<ViewKey>("pos")
  const { user, logout } = useAuth()
  const itemCount = useCart((s) => s.getItemCount())

  const handleLogout = async () => {
    await logout()
    toast.success("Berhasil keluar")
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm h-14">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-none">POS Kasir Pro</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sistem Kasir & Inventory</p>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="ml-auto hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = view === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.key === "pos" && itemCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {itemCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="ml-auto md:ml-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="font-semibold">{user?.name}</p>
                  <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                  <span className="inline-block mt-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary capitalize">
                    {user?.role}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {view === "pos" && <PosView />}
        {view === "products" && <ProductsView />}
        {view === "inventory" && <InventoryView />}
        {view === "sales" && <SalesView />}
        {view === "reports" && <ReportsView />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sticky bottom-0 z-40 border-t bg-card md:hidden">
        <div className="flex">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = view === item.key
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.key === "pos" && itemCount > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {itemCount}
                    </span>
                  )}
                </div>
                {item.label}
                {active && <div className="absolute bottom-0 h-0.5 w-8 rounded-full bg-primary" />}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
