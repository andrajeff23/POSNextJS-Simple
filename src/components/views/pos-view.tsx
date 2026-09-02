"use client"

import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search, Trash2, Plus, Minus, X, ShoppingCart, Loader2, Printer, CheckCircle2,
  Wallet, QrCode, CreditCard, PackageSearch,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDateTime } from "@/lib/format"
import { useCart } from "@/store/cart"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Category { id: string; name: string; icon: string | null; color: string }
interface Product {
  id: string; name: string; sku: string | null; barcode: string | null; price: number; cost: number
  stock: number; minStock: number; unit: string; image: string | null; categoryId: string
  category: Category; isActive: boolean
}

export function PosView() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [cartOpen, setCartOpen] = useState(false)

  // Debounce search
  useMemo(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", debouncedSearch, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (categoryId) params.set("categoryId", categoryId)
      const res = await fetch(`/api/products?${params}`)
      if (!res.ok) throw new Error("Gagal memuat produk")
      return res.json() as Promise<Product[]>
    },
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories")
      if (!res.ok) throw new Error("Gagal memuat kategori")
      return res.json() as Promise<Category[]>
    },
  })

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: Product browser */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search + categories */}
        <div className="border-b bg-card p-3 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari produk (nama / SKU / barcode)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <CategoryChip label="Semua" icon="🏷️" active={!categoryId} onClick={() => setCategoryId("")} />
            {categories.map((c) => (
              <CategoryChip key={c.id} label={c.name} icon={c.icon || "📦"} active={categoryId === c.id} onClick={() => setCategoryId(c.id)} />
            ))}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-36 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <PackageSearch className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">Produk tidak ditemukan</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart panel (desktop) */}
      <aside className="hidden lg:flex w-[380px] xl:w-[420px] border-l bg-card flex-col shrink-0">
        <CartPanel />
      </aside>

      {/* Mobile cart trigger */}
      <MobileCartBar onClick={() => setCartOpen(true)} />

      {/* Mobile cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" className="h-[92vh] p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Keranjang Belanja
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <CartPanel onCheckoutSuccess={() => setCartOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function CategoryChip({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:bg-accent border-border"
      )}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

function ProductCard({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem)
  const outOfStock = product.stock === 0
  const lowStock = product.stock > 0 && product.stock <= product.minStock

  return (
    <button
      onClick={() => !outOfStock && addItem({ id: product.id, name: product.name, price: product.price, cost: product.cost, image: product.image, stock: product.stock })}
      disabled={outOfStock}
      className={cn(
        "group relative flex flex-col rounded-lg border bg-card p-3 text-left transition-all hover:shadow-md hover:border-primary/50",
        outOfStock && "opacity-50 cursor-not-allowed hover:shadow-none"
      )}
    >
      <div className="flex h-16 items-center justify-center rounded-md bg-muted mb-2 text-4xl">
        {product.image || "📦"}
      </div>
      <p className="text-sm font-medium leading-tight line-clamp-2 mb-1">{product.name}</p>
      <p className="text-sm font-bold text-primary">{formatCurrency(product.price)}</p>
      <div className="mt-1">
        {outOfStock ? (
          <Badge variant="destructive" className="text-[10px]">Habis</Badge>
        ) : lowStock ? (
          <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">Stok {product.stock}</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200">Stok {product.stock}</Badge>
        )}
      </div>
    </button>
  )
}

function MobileCartBar({ onClick }: { onClick: () => void }) {
  const itemCount = useCart((s) => s.getItemCount())
  const total = useCart((s) => s.getTotal())
  if (itemCount === 0) return null
  return (
    <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 p-3 bg-card/95 backdrop-blur-sm border-t">
      <Button onClick={onClick} className="w-full h-12 justify-between" size="lg">
        <span className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {itemCount} item
        </span>
        <span>{formatCurrency(total)}</span>
      </Button>
    </div>
  )
}

function CartPanel({ onCheckoutSuccess }: { onCheckoutSuccess?: () => void }) {
  const { items, discount, customerName, removeItem, updateQty, clear, setDiscount, setCustomerName, getSubtotal, getTotal, getItemCount } = useCart()
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "qris" | "card">("cash")
  const [paidAmount, setPaidAmount] = useState(0)
  const [receipt, setReceipt] = useState<any>(null)
  const qc = useQueryClient()

  const subtotal = getSubtotal()
  const total = getTotal()
  const change = paidAmount - total
  const itemCount = getItemCount()

  const checkoutMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
          discount, paidAmount: paymentMethod === "cash" ? paidAmount : total,
          paymentMethod, customerName: customerName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi")
      return data
    },
    onSuccess: (data) => {
      toast.success(`Transaksi ${data.invoiceNo} berhasil!`)
      setReceipt(data)
      clear()
      setPaidAmount(0)
      setPaymentMethod("cash")
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["sales"] })
      onCheckoutSuccess?.()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCheckout = () => {
    if (itemCount === 0) return
    if (paymentMethod === "cash" && paidAmount < total) {
      toast.error("Jumlah bayar kurang dari total")
      return
    }
    checkoutMut.mutate()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - FIXED */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">Keranjang</h2>
          {itemCount > 0 && <Badge className="bg-primary">{itemCount}</Badge>}
        </div>
        {itemCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { clear(); setPaidAmount(0) }} className="text-destructive hover:text-destructive h-8">
            <Trash2 className="h-4 w-4" /> Kosongkan
          </Button>
        )}
      </div>

      {/* Items - SCROLLABLE (flex-1) */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Keranjang kosong</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Pilih produk untuk memulai transaksi</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {items.map((item) => (
              <div key={item.productId} className="flex gap-2 rounded-lg border bg-background p-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xl">{item.image || "📦"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium leading-tight line-clamp-1">{item.name}</p>
                    <button onClick={() => removeItem(item.productId)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatCurrency(item.price)}</p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.productId, item.qty - 1)} className="flex h-6 w-6 items-center justify-center rounded border hover:bg-accent">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                      <button onClick={() => updateQty(item.productId, item.qty + 1)} disabled={item.qty >= item.stock} className="flex h-6 w-6 items-center justify-center rounded border hover:bg-accent disabled:opacity-40">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-sm font-bold">{formatCurrency(item.price * item.qty)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - FIXED (totals + payment + checkout) */}
      {items.length > 0 && (
        <div className="border-t bg-card shrink-0">
          <div className="p-3 space-y-3">
            {/* Customer name */}
            <Input
              placeholder="Nama pelanggan (opsional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-8 text-sm"
            />

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Diskon</span>
                <Input
                  type="number"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="w-24 h-7 text-sm text-right"
                  placeholder="0"
                />
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="grid grid-cols-3 gap-1.5">
              <PayButton active={paymentMethod === "cash"} onClick={() => { setPaymentMethod("cash"); if (paidAmount < total) setPaidAmount(0) }} icon={<Wallet className="h-4 w-4" />} label="Tunai" />
              <PayButton active={paymentMethod === "qris"} onClick={() => { setPaymentMethod("qris"); setPaidAmount(total) }} icon={<QrCode className="h-4 w-4" />} label="QRIS" />
              <PayButton active={paymentMethod === "card"} onClick={() => { setPaymentMethod("card"); setPaidAmount(total) }} icon={<CreditCard className="h-4 w-4" />} label="Kartu" />
            </div>

            {/* Paid amount (cash only) */}
            {paymentMethod === "cash" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Jumlah Bayar</Label>
                <Input
                  type="number"
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  className="h-9 text-lg font-semibold"
                  placeholder="0"
                />
                <div className="grid grid-cols-4 gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPaidAmount(total)}>Pas</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPaidAmount(20000)}>20rb</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPaidAmount(50000)}>50rb</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setPaidAmount(100000)}>100rb</Button>
                </div>
              </div>
            )}

            {/* Change */}
            {paymentMethod === "cash" && paidAmount > 0 && (
              <div className={cn("flex justify-between items-center rounded-lg px-3 py-2 text-sm font-medium", change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive")}>
                <span>{change >= 0 ? "Kembalian" : "Kurang"}</span>
                <span>{formatCurrency(Math.abs(change))}</span>
              </div>
            )}

            {/* Checkout button */}
            <Button onClick={handleCheckout} disabled={checkoutMut.isPending || (paymentMethod === "cash" && paidAmount < total)} className="w-full h-11" size="lg">
              {checkoutMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Bayar & Cetak • ${formatCurrency(total)}`}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(open) => !open && setReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Transaksi Berhasil
            </DialogTitle>
          </DialogHeader>
          {receipt && <Receipt data={receipt} onClose={() => setReceipt(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PayButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function Receipt({ data, onClose }: { data: any; onClose: () => void }) {
  return (
    <div className="space-y-3">
      <div className="text-center text-sm border-y border-dashed py-3 font-mono">
        <p className="font-bold">POS Kasir Pro</p>
        <p className="text-xs text-muted-foreground">{data.invoiceNo}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(data.createdAt)}</p>
        {data.cashierName && <p className="text-xs text-muted-foreground">Kasir: {data.cashierName}</p>}
      </div>
      <div className="space-y-1 text-xs font-mono">
        {data.items?.map((item: any) => (
          <div key={item.id} className="flex justify-between">
            <span className="truncate">{item.qty}x {item.product?.name}</span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed pt-2 space-y-1 text-xs font-mono">
        <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(data.subtotal)}</span></div>
        {data.discount > 0 && <div className="flex justify-between"><span>Diskon</span><span>-{formatCurrency(data.discount)}</span></div>}
        <div className="flex justify-between font-bold text-sm"><span>Total</span><span>{formatCurrency(data.total)}</span></div>
        <div className="flex justify-between"><span>Bayar ({data.paymentMethod})</span><span>{formatCurrency(data.paidAmount)}</span></div>
        <div className="flex justify-between"><span>Kembali</span><span>{formatCurrency(data.changeAmount)}</span></div>
      </div>
      <p className="text-center text-xs text-muted-foreground pt-2">Terima kasih atas kunjungan Anda!</p>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => { toast.success("Struk dicetak") }}>
          <Printer className="h-4 w-4" /> Cetak
        </Button>
        <Button className="flex-1" onClick={onClose}>Transaksi Baru</Button>
      </div>
    </div>
  )
}
