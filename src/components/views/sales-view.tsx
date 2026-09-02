"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search, Eye, Printer, Receipt as ReceiptIcon, Wallet, QrCode, CreditCard,
  ShoppingBag, TrendingUp, Coins, Package, X, CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"

/* ------------------------------- Types ------------------------------- */

interface SaleItem {
  id: string
  productId: string
  qty: number
  price: number
  cost: number
  subtotal: number
  product: {
    id: string
    name: string
    image: string | null
    category?: { name: string } | null
  }
}

interface Sale {
  id: string
  invoiceNo: string
  subtotal: number
  discount: number
  tax: number
  total: number
  paidAmount: number
  changeAmount: number
  paymentMethod: "cash" | "qris" | "card" | string
  status: string
  customerName: string | null
  cashierName: string | null
  note: string | null
  createdAt: string
  items: SaleItem[]
}

/* --------------------------- Helpers --------------------------------- */

type QuickFilter = "today" | "7d" | "30d" | "all"

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "all", label: "Semua" },
]

function computeRange(filter: QuickFilter): { startDate?: string; endDate?: string } {
  if (filter === "all") return {}
  const now = new Date()
  const start = new Date()
  if (filter === "today") {
    start.setHours(0, 0, 0, 0)
  } else if (filter === "7d") {
    start.setDate(now.getDate() - 6)
    start.setHours(0, 0, 0, 0)
  } else if (filter === "30d") {
    start.setDate(now.getDate() - 29)
    start.setHours(0, 0, 0, 0)
  }
  return {
    startDate: start.toISOString(),
    endDate: now.toISOString(),
  }
}

const PAYMENT_META: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: React.ReactNode }> = {
  cash: { label: "Tunai", variant: "default", icon: <Wallet className="h-3 w-3" /> },
  qris: { label: "QRIS", variant: "secondary", icon: <QrCode className="h-3 w-3" /> },
  card: { label: "Kartu", variant: "outline", icon: <CreditCard className="h-3 w-3" /> },
}

function paymentMeta(method: string) {
  return PAYMENT_META[method] ?? { label: method.toUpperCase(), variant: "outline" as const, icon: <CreditCard className="h-3 w-3" /> }
}

/* ----------------------------- Component ----------------------------- */

export function SalesView() {
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("30d")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const { startDate, endDate } = useMemo(() => computeRange(quickFilter), [quickFilter])

  const { data: sales = [], isLoading, isError } = useQuery<Sale[]>({
    queryKey: ["sales", debouncedSearch, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      params.set("limit", "200")
      const res = await fetch(`/api/sales?${params}`)
      if (!res.ok) throw new Error("Gagal memuat data penjualan")
      return res.json()
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (isError) toast.error("Gagal memuat data penjualan")
  }, [isError])

  // Computed stats
  const stats = useMemo(() => {
    const totalTransactions = sales.length
    const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
    const avg = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    const itemsSold = sales.reduce(
      (s, x) => s + (x.items?.reduce((a, i) => a + i.qty, 0) ?? 0),
      0,
    )
    return { totalTransactions, totalRevenue, avg, itemsSold }
  }, [sales])

  const selectedSale = useMemo(
    () => sales.find((s) => s.id === selectedId) ?? null,
    [sales, selectedId],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b bg-card px-4 py-4 sm:px-6 space-y-3 shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ReceiptIcon className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Riwayat Penjualan</h1>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari invoice / pelanggan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-10"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Bersihkan pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick date filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <CalendarDays className="h-3.5 w-3.5" /> Periode:
          </div>
          <div className="inline-flex rounded-lg border bg-background p-1 gap-0.5">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                  quickFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Stats summary */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={<ShoppingBag className="h-4 w-4" />}
            iconColor="bg-primary/10 text-primary"
            label="Total Transaksi"
            value={formatNumber(stats.totalTransactions)}
            sub="dalam periode"
            loading={isLoading}
          />
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            iconColor="bg-emerald-500/10 text-emerald-600"
            label="Total Pendapatan"
            value={formatCurrency(stats.totalRevenue)}
            sub="omzet kotor"
            loading={isLoading}
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            iconColor="bg-amber-500/10 text-amber-600"
            label="Rata-rata / Transaksi"
            value={formatCurrency(stats.avg)}
            sub="per transaksi"
            loading={isLoading}
          />
          <StatCard
            icon={<Package className="h-4 w-4" />}
            iconColor="bg-rose-500/10 text-rose-600"
            label="Item Terjual"
            value={formatNumber(stats.itemsSold)}
            sub="unit terjual"
            loading={isLoading}
          />
        </section>

        {/* Sales list */}
        <Card className="py-0 gap-0">
          {isLoading ? (
            <SaleListSkeleton />
          ) : sales.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-6">No. Invoice</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-center">Item</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center">Pembayaran</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => {
                      const pm = paymentMeta(sale.paymentMethod)
                      const itemCount = sale.items?.reduce((a, i) => a + i.qty, 0) ?? 0
                      return (
                        <TableRow key={sale.id} className="hover:bg-muted/30">
                          <TableCell className="pl-6 py-3">
                            <div className="font-mono text-sm font-semibold">{sale.invoiceNo}</div>
                            {sale.customerName && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {sale.customerName}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDateTime(sale.createdAt)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="font-mono">
                              {itemCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(sale.total)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={pm.variant} className="gap-1">
                              {pm.icon}
                              {pm.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              Selesai
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedId(sale.id)}
                            >
                              <Eye className="h-3.5 w-3.5" /> Lihat Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {sales.map((sale) => {
                  const pm = paymentMeta(sale.paymentMethod)
                  const itemCount = sale.items?.reduce((a, i) => a + i.qty, 0) ?? 0
                  return (
                    <button
                      key={sale.id}
                      onClick={() => setSelectedId(sale.id)}
                      className="w-full text-left p-4 hover:bg-muted/30 transition-colors block"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-semibold truncate">
                            {sale.invoiceNo}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatDateTime(sale.createdAt)}
                          </div>
                          {sale.customerName && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {sale.customerName}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-primary">
                            {formatCurrency(sale.total)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {itemCount} item
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant={pm.variant} className="gap-1">
                          {pm.icon}
                          {pm.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Selesai
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Detail / Receipt dialog */}
      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptIcon className="h-5 w-5 text-primary" />
              Detail Transaksi
            </DialogTitle>
            <DialogDescription className="sr-only">
              Rincian transaksi penjualan
            </DialogDescription>
          </DialogHeader>
          {selectedSale ? (
            <Receipt sale={selectedSale} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="space-y-3 py-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ----------------------------- Sub-components ----------------------------- */

function StatCard({
  icon, iconColor, label, value, sub, loading,
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
  sub: string
  loading?: boolean
}) {
  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full", iconColor)}>
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-28" />
      ) : (
        <p className="text-lg sm:text-xl font-bold tracking-tight truncate">{value}</p>
      )}
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  )
}

function SaleListSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
        <ReceiptIcon className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Belum ada transaksi.</p>
      <p className="text-xs text-muted-foreground mt-1">
        Transaksi yang dibuat akan muncul di sini.
      </p>
    </div>
  )
}

function Receipt({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const pm = paymentMeta(sale.paymentMethod)
  const itemCount = sale.items?.reduce((a, i) => a + i.qty, 0) ?? 0

  return (
    <div className="space-y-3">
      {/* Store header */}
      <div className="text-center border-y border-dashed py-3 font-mono">
        <p className="font-bold text-base">POS Kasir Pro</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sale.invoiceNo}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}</p>
        {sale.cashierName && (
          <p className="text-xs text-muted-foreground">Kasir: {sale.cashierName}</p>
        )}
        {sale.customerName && (
          <p className="text-xs text-muted-foreground">Pelanggan: {sale.customerName}</p>
        )}
      </div>

      {/* Items table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-3">Item</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right pr-3">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sale.items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="pl-3 py-2">
                  <div className="font-medium text-sm">{item.product?.name ?? "Produk"}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {item.qty} x {formatCurrency(item.price)}
                  </div>
                </TableCell>
                <TableCell className="text-center text-sm font-mono">{item.qty}</TableCell>
                <TableCell className="text-right pr-3 text-sm font-medium">
                  {formatCurrency(item.subtotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatCurrency(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Diskon</span>
            <span>-{formatCurrency(sale.discount)}</span>
          </div>
        )}
        {sale.tax > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Pajak</span>
            <span>{formatCurrency(sale.tax)}</span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(sale.total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Metode Bayar</span>
          <Badge variant={pm.variant} className="gap-1">
            {pm.icon}
            {pm.label}
          </Badge>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Jumlah Bayar</span>
          <span className="font-mono">{formatCurrency(sale.paidAmount)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Kembalian</span>
          <span className="font-mono">{formatCurrency(sale.changeAmount)}</span>
        </div>
      </div>

      {/* Note */}
      {sale.note && (
        <div className="rounded-lg border p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1">Catatan</p>
          <p className="text-sm">{sale.note}</p>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {itemCount} item • Terima kasih atas kunjungan Anda!
      </p>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => toast.success("Struk dicetak")}
        >
          <Printer className="h-4 w-4" /> Cetak Struk
        </Button>
        <Button className="flex-1" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </div>
  )
}
