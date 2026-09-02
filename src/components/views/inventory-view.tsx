"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search, Package, AlertTriangle, PackageX, Wallet,
  History, Loader2, X, PackageSearch, RefreshCw, ArrowUpRight, ArrowDownRight,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber, formatDateTime } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

// ---------- Types ----------
interface Category {
  id: string
  name: string
  icon: string | null
  color: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  price: number
  cost: number
  stock: number
  minStock: number
  unit: string
  image: string | null
  categoryId: string
  isActive: boolean
  category: Category
}

interface StockMovement {
  id: string
  productId: string
  type: string       // "in" | "out" | "adjustment"
  reason: string     // "restock" | "damaged" | "lost" | "opname" | "other" | "initial" | "adjustment"
  qty: number        // signed change
  balance: number
  note: string | null
  createdAt: string
}

type TabValue = "all" | "menipis" | "habis"
type RestockType = "in" | "out" | "adjustment"
type RestockReason = "restock" | "damaged" | "lost" | "opname" | "other"

// ---------- Component ----------
export function InventoryView() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [tab, setTab] = useState<TabValue>("all")

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // lowStock filter: "true" only for "menipis" tab.
  // For "habis" tab we filter client-side (stock === 0)
  const lowStockParam = tab === "menipis" ? "true" : ""

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", debounced, "", lowStockParam],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debounced) params.set("search", debounced)
      if (lowStockParam) params.set("lowStock", lowStockParam)
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

  // For "habis" tab, filter client-side. For "menipis" tab, the API returns
  // stock <= minStock (which includes habis); we exclude pure-habis items so
  // the "Menipis" tab shows only amber items (red items live in their own tab).
  const visibleProducts = useMemo(() => {
    if (tab === "menipis") return products.filter((p) => p.stock > 0 && p.stock <= p.minStock)
    if (tab === "habis") return products.filter((p) => p.stock === 0)
    return products
  }, [products, tab])

  // Stats — computed on all fetched products (no tab filter)
  const stats = useMemo(() => {
    const total = products.length
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0)
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length
    const inventoryValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)
    return { total, totalUnits, lowStock, inventoryValue }
  }, [products])

  // Counts for tabs (match what each tab actually shows)
  const counts = useMemo(() => {
    const menipis = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length
    const habis = products.filter((p) => p.stock === 0).length
    return { menipis, habis }
  }, [products])

  // Dialog state
  const [restockTarget, setRestockTarget] = useState<Product | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Product | null>(null)

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name || "—"

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Manajemen Inventory</h1>
          <p className="text-sm text-muted-foreground">Pantau stok dan pergerakan barang</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total Produk"
          value={formatNumber(stats.total)}
          icon={<Package className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Total Stok"
          value={`${formatNumber(stats.totalUnits)} unit`}
          icon={<Settings2 className="h-4 w-4" />}
          tone="emerald"
        />
        <StatCard
          label="Stok Menipis"
          value={formatNumber(stats.lowStock)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Nilai Inventory"
          value={formatCurrency(stats.inventoryValue)}
          icon={<Wallet className="h-4 w-4" />}
          tone="default"
        />
      </div>

      {/* Filters */}
      <Card className="p-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari produk untuk restok..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              Semua
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">
                {formatNumber(stats.total)}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="menipis" className="text-xs sm:text-sm">
              <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" />
              Menipis
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5 bg-amber-100 text-amber-700">
                {formatNumber(counts.menipis)}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="habis" className="text-xs sm:text-sm">
              <PackageX className="h-3.5 w-3.5 mr-1 text-rose-500" />
              Habis
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5 bg-rose-100 text-rose-700">
                {formatNumber(counts.habis)}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/* Content */}
      {isLoading ? (
        <InventorySkeleton />
      ) : visibleProducts.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-10 w-10 text-muted-foreground/40" />}
          title={tab === "habis" ? "Tidak ada produk habis" : tab === "menipis" ? "Tidak ada stok menipis" : "Produk tidak ditemukan"}
          description={
            tab === "habis"
              ? "Semua produk masih memiliki stok"
              : tab === "menipis"
                ? "Semua stok di atas batas minimum"
                : "Coba ubah kata kunci pencarian"
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[26%]">Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="w-[18%]">Stok Saat Ini</TableHead>
                  <TableHead className="text-center">Stok Min</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Nilai</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProducts.map((p) => (
                  <InventoryRow
                    key={p.id}
                    product={p}
                    categoryName={categoryName(p.categoryId)}
                    onRestock={() => setRestockTarget(p)}
                    onHistory={() => setHistoryTarget(p)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {visibleProducts.map((p) => (
              <InventoryCardMobile
                key={p.id}
                product={p}
                categoryName={categoryName(p.categoryId)}
                onRestock={() => setRestockTarget(p)}
                onHistory={() => setHistoryTarget(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* Restock dialog */}
      <RestockDialog
        product={restockTarget}
        onClose={() => setRestockTarget(null)}
      />

      {/* History dialog */}
      <HistoryDialog
        product={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  )
}

// ---------- Stat Card ----------
function StatCard({
  label, value, icon, tone,
}: { label: string; value: string; icon: React.ReactNode; tone: "default" | "emerald" | "amber" | "rose" }) {
  const tones = {
    default: "bg-muted/60 text-foreground",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", tones[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
          <p className="text-lg font-bold leading-tight mt-0.5 truncate">{value}</p>
        </div>
      </div>
    </Card>
  )
}

// ---------- Stock helpers ----------
function stockColor(stock: number, min: number) {
  if (stock === 0) return "text-rose-600"
  if (stock <= min) return "text-amber-600"
  return "text-emerald-600"
}

function stockProgressColor(stock: number, min: number) {
  if (stock === 0) return "bg-rose-500"
  if (stock <= min) return "bg-amber-500"
  return "bg-emerald-500"
}

function stockStatusBadge(stock: number, minStock: number) {
  if (stock === 0) {
    return <Badge variant="destructive" className="text-[10px]">Habis</Badge>
  }
  if (stock <= minStock) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">
        Menipis
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">
      Aman
    </Badge>
  )
}

// ---------- Inventory Row (Desktop) ----------
function InventoryRow({
  product, categoryName, onRestock, onHistory,
}: {
  product: Product
  categoryName: string
  onRestock: () => void
  onHistory: () => void
}) {
  const progressValue = Math.min(100, product.minStock > 0 ? (product.stock / (product.minStock * 3)) * 100 : 100)
  const inventoryValue = product.price * product.stock

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
            {product.image || "📦"}
          </div>
          <div className="min-w-0">
            <p className="font-medium leading-tight truncate">{product.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {product.sku ? `SKU: ${product.sku}` : "—"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{categoryName}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={cn("text-sm font-semibold", stockColor(product.stock, product.minStock))}>
              {formatNumber(product.stock)} {product.unit}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", stockProgressColor(product.stock, product.minStock))}
              style={{ width: `${progressValue}%` }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center text-sm text-muted-foreground">
        {formatNumber(product.minStock)} {product.unit}
      </TableCell>
      <TableCell className="text-center">
        {stockStatusBadge(product.stock, product.minStock)}
      </TableCell>
      <TableCell className="text-right text-sm font-medium">
        {formatCurrency(inventoryValue)}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRestock}>
            <RefreshCw className="h-3.5 w-3.5" />
            Restok
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onHistory} title="Riwayat">
            <History className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

// ---------- Inventory Card (Mobile) ----------
function InventoryCardMobile({
  product, categoryName, onRestock, onHistory,
}: {
  product: Product
  categoryName: string
  onRestock: () => void
  onHistory: () => void
}) {
  const progressValue = Math.min(100, product.minStock > 0 ? (product.stock / (product.minStock * 3)) * 100 : 100)
  const inventoryValue = product.price * product.stock

  return (
    <Card className="p-3">
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-2xl">
          {product.image || "📦"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium leading-tight truncate">{product.name}</p>
              <p className="text-[11px] text-muted-foreground">{categoryName}</p>
            </div>
            {stockStatusBadge(product.stock, product.minStock)}
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Stok</span>
              <span className={cn("font-semibold", stockColor(product.stock, product.minStock))}>
                {formatNumber(product.stock)} {product.unit}
                <span className="text-muted-foreground font-normal"> / min {product.minStock}</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", stockProgressColor(product.stock, product.minStock))}
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              Nilai: <span className="font-medium text-foreground">{formatCurrency(inventoryValue)}</span>
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRestock}>
                <RefreshCw className="h-3.5 w-3.5" /> Restok
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onHistory} title="Riwayat">
                <History className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------- Restock Dialog ----------
function RestockDialog({
  product, onClose,
}: { product: Product | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [type, setType] = useState<RestockType>("in")
  const [reason, setReason] = useState<RestockReason>("restock")
  const [qty, setQty] = useState<string>("")
  const [note, setNote] = useState<string>("")

  useEffect(() => {
    if (product) {
      setType("in")
      setReason("restock")
      setQty("")
      setNote("")
    }
  }, [product])

  const numQty = Number(qty) || 0
  const currentStock = product?.stock ?? 0
  const minStock = product?.minStock ?? 0
  let change = 0
  if (type === "in") change = Math.abs(numQty)
  if (type === "out") change = -Math.abs(numQty)
  if (type === "adjustment") change = numQty
  const newBalance = currentStock + change
  const isInvalid = numQty === 0 || newBalance < 0

  const mut = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Produk tidak valid")
      if (numQty === 0) throw new Error("Jumlah tidak boleh nol")
      if (newBalance < 0) throw new Error("Stok tidak boleh negatif")
      const res = await fetch(`/api/stock/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, reason, qty: numQty, note: note.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menyesuaikan stok")
      return data
    },
    onSuccess: () => {
      toast.success("Stok berhasil diperbarui")
      qc.invalidateQueries({ queryKey: ["products"] })
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (!product) return null

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> Restok Produk
          </DialogTitle>
          <DialogDescription>Sesuaikan stok produk dan catat alasannya</DialogDescription>
        </DialogHeader>

        {/* Product info */}
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-xl">
            {product.image || "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{product.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Stok saat ini: <span className="font-medium text-foreground">{formatNumber(product.stock)} {product.unit}</span>
              {" · "}Min: {product.minStock}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipe</Label>
              <Select value={type} onValueChange={(v) => setType(v as RestockType)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Tambah Stok</SelectItem>
                  <SelectItem value="out">Kurangi Stok</SelectItem>
                  <SelectItem value="adjustment">Set Absolut</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Alasan</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as RestockReason)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">Restok</SelectItem>
                  <SelectItem value="damaged">Rusak</SelectItem>
                  <SelectItem value="lost">Hilang</SelectItem>
                  <SelectItem value="opname">Opname</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-qty">
              Jumlah {type === "adjustment" ? "(stok akhir)" : `(${type === "in" ? "bertambah" : "berkurang"})`}
            </Label>
            <Input
              id="r-qty"
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
              className="h-10 text-base font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-note" className="text-xs">Catatan (opsional)</Label>
            <Textarea
              id="r-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: pembelian dari supplier PT Sejahtera"
              rows={2}
            />
          </div>

          {/* Preview */}
          <div className="rounded-md border p-2.5 space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Stok Saat Ini</span>
              <span className="font-medium">{formatNumber(product.stock)} {product.unit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Perubahan</span>
              <span className={cn("font-semibold flex items-center gap-1", change > 0 ? "text-emerald-600" : change < 0 ? "text-rose-600" : "text-muted-foreground")}>
                {change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : change < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                {change > 0 ? "+" : ""}{formatNumber(change)} {product.unit}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-1">
              <span className="text-muted-foreground">Stok Akhir</span>
              <span className={cn(
                "font-bold text-base",
                newBalance === 0 ? "text-rose-600" : newBalance <= product.minStock ? "text-amber-600" : "text-emerald-600"
              )}>
                {formatNumber(newBalance)} {product.unit}
              </span>
            </div>
            {newBalance < 0 && (
              <p className="text-xs text-destructive">Stok tidak boleh negatif</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || isInvalid}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- History Dialog ----------
function HistoryDialog({
  product, onClose,
}: { product: Product | null; onClose: () => void }) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["stock-movements", product?.id],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${product!.id}`)
      if (!res.ok) throw new Error("Gagal memuat riwayat")
      return res.json() as Promise<StockMovement[]>
    },
    enabled: !!product,
  })

  if (!product) return null

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Riwayat Stok
          </DialogTitle>
          <DialogDescription>
            50 pergerakan stok terakhir untuk <strong className="text-foreground">{product.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Current stock */}
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-xl">
            {product.image || "📦"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{product.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Stok saat ini:{" "}
              <span className={cn("font-medium", stockColor(product.stock, product.minStock))}>
                {formatNumber(product.stock)} {product.unit}
              </span>
              {" · "}Min: {product.minStock}
            </p>
          </div>
        </div>

        {/* Movements table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Belum ada pergerakan stok
          </div>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                  <TableRow>
                    <TableHead className="text-xs">Tanggal</TableHead>
                    <TableHead className="text-xs">Tipe</TableHead>
                    <TableHead className="text-xs">Alasan</TableHead>
                    <TableHead className="text-xs text-right">Jumlah</TableHead>
                    <TableHead className="text-xs text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <MovementRow key={m.id} movement={m} unit={product.unit} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MovementRow({ movement, unit }: { movement: StockMovement; unit: string }) {
  const isPositive = movement.qty > 0
  const isNegative = movement.qty < 0

  const typeLabel: Record<string, string> = {
    in: "Masuk",
    out: "Keluar",
    adjustment: "Sesuaikan",
  }
  const typeVariant: Record<string, string> = {
    in: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    out: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    adjustment: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  }

  const reasonLabel: Record<string, string> = {
    restock: "Restok",
    damaged: "Rusak",
    lost: "Hilang",
    opname: "Opname",
    other: "Lainnya",
    initial: "Stok Awal",
    adjustment: "Penyesuaian",
  }

  return (
    <TableRow className="text-xs">
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {formatDateTime(movement.createdAt)}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={cn("text-[10px]", typeVariant[movement.type] || "bg-muted")}>
          {typeLabel[movement.type] || movement.type}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {reasonLabel[movement.reason] || movement.reason}
        {movement.note && (
          <p className="text-[10px] text-muted-foreground/80 truncate max-w-[140px]" title={movement.note}>
            {movement.note}
          </p>
        )}
      </TableCell>
      <TableCell className={cn(
        "text-right font-semibold tabular-nums",
        isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-muted-foreground"
      )}>
        {isPositive ? "+" : ""}{formatNumber(movement.qty)} {unit}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatNumber(movement.balance)} {unit}
      </TableCell>
    </TableRow>
  )
}

// ---------- Skeleton ----------
function InventorySkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------- Empty State ----------
function EmptyState({
  icon, title, description,
}: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center">
      {icon}
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </Card>
  )
}
