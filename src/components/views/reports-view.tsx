"use client"

import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  RefreshCw, TrendingUp, DollarSign, ShoppingBag, BarChart3,
  Wallet, QrCode, CreditCard, Package, AlertTriangle, PackageX,
  Boxes, Trophy, PieChart as PieIcon, CalendarRange, Loader2,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { cn } from "@/lib/utils"
import {
  formatCurrency, formatNumber, formatShortDate,
} from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

/* --------------------------- Constants -------------------------------- */

const CHART_COLORS = [
  "#10b981", "#14b8a6", "#f59e0b", "#f97316",
  "#f43f5e", "#8b5cf6", "#06b6d4", "#ec4899",
] as const

const PERIOD_OPTIONS = [
  { value: "7", label: "7 Hari" },
  { value: "14", label: "14 Hari" },
  { value: "30", label: "30 Hari" },
] as const

/* --------------------------- Types ------------------------------------ */

interface SummaryData {
  totalRevenue: number
  totalTransactions: number
  totalItemsSold: number
  avgTransaction: number
  totalProfit: number
  totalCost: number
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
  inventoryValue: number
  inventoryCost: number
  paymentBreakdown: { cash: number; qris: number; card: number }
  lowStockProducts: Array<{ id: string; name: string; stock: number; minStock: number }>
}

interface SalesPoint {
  date: string
  revenue: number
  transactions: number
  items: number
  profit: number
}

interface ProductStat {
  productId: string
  productName: string
  category: string
  qty: number
  revenue: number
  profit: number
}

interface ProductsReport {
  topProducts: ProductStat[]
  allProducts: ProductStat[]
  byCategory: Array<{ name: string; revenue: number; qty: number }>
}

/* --------------------------- Helpers ---------------------------------- */

/** Abbreviate currency for chart axis (e.g. "Rp 284 rb", "Rp 1.2 jt"). */
function abbreviateCurrency(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`
  if (abs >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`
  if (abs >= 1_000) return `Rp ${Math.round(value / 1_000)} rb`
  return `Rp ${value}`
}

/* --------------------------- Chart tooltips --------------------------- */

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as SalesPoint
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-xs space-y-1">
      <p className="font-medium">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-muted-foreground">Pendapatan:</span>
        <span className="font-semibold">{formatCurrency(point.revenue)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-teal-400" />
        <span className="text-muted-foreground">Keuntungan:</span>
        <span className="font-semibold">{formatCurrency(point.profit)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Transaksi:</span>
        <span className="font-semibold">{point.transactions}</span>
      </div>
    </div>
  )
}

function ProductTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as ProductStat
  if (!p) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-xs space-y-1 max-w-[220px]">
      <p className="font-medium truncate">{p.productName}</p>
      <p className="text-muted-foreground">{p.category}</p>
      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-muted-foreground">Terjual:</span>
        <span className="font-semibold">{formatNumber(p.qty)} unit</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Pendapatan:</span>
        <span className="font-semibold">{formatCurrency(p.revenue)}</span>
      </div>
    </div>
  )
}

function CategoryTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload as { name: string; revenue: number; qty: number; percent: number }
  if (!p) return null
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-xs space-y-1">
      <p className="font-medium">{p.name}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Pendapatan:</span>
        <span className="font-semibold">{formatCurrency(p.revenue)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Unit terjual:</span>
        <span className="font-semibold">{formatNumber(p.qty)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Pangsa:</span>
        <span className="font-semibold">{p.percent.toFixed(1)}%</span>
      </div>
    </div>
  )
}

/* --------------------------- Component -------------------------------- */

export function ReportsView() {
  const [days, setDays] = useState<string>("7")
  const qc = useQueryClient()

  const summaryQuery = useQuery<SummaryData>({
    queryKey: ["reports", "summary", days],
    queryFn: async () => {
      const res = await fetch(`/api/reports/summary?days=${days}`)
      if (!res.ok) throw new Error("Gagal memuat ringkasan")
      return res.json()
    },
  })

  const salesQuery = useQuery<SalesPoint[]>({
    queryKey: ["reports", "sales", days],
    queryFn: async () => {
      const res = await fetch(`/api/reports/sales?days=${days}`)
      if (!res.ok) throw new Error("Gagal memuat tren penjualan")
      return res.json()
    },
  })

  const productsQuery = useQuery<ProductsReport>({
    queryKey: ["reports", "products", days],
    queryFn: async () => {
      const res = await fetch(`/api/reports/products?days=${days}`)
      if (!res.ok) throw new Error("Gagal memuat produk")
      return res.json()
    },
  })

  const isLoading = summaryQuery.isLoading || salesQuery.isLoading || productsQuery.isLoading
  const isEmpty =
    !isLoading &&
    (summaryQuery.data?.totalTransactions ?? 0) === 0 &&
    (salesQuery.data?.length ?? 0) === 0

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["reports"] })
    toast.success("Data diperbarui")
  }

  // Daily breakdown sorted newest first
  const dailyBreakdown = useMemo(() => {
    const list = salesQuery.data ? [...salesQuery.data] : []
    list.sort((a, b) => (a.date < b.date ? 1 : -1))
    return list
  }, [salesQuery.data])

  // Top products for bar chart (5-8)
  const topProducts = useMemo(() => {
    const list = productsQuery.data?.topProducts ?? []
    return list.slice(0, Math.min(8, Math.max(5, list.length)))
  }, [productsQuery.data])

  // Category breakdown with percentages
  const categoryData = useMemo(() => {
    const cats = productsQuery.data?.byCategory ?? []
    const totalRevenue = cats.reduce((s, c) => s + c.revenue, 0)
    if (totalRevenue === 0) return []
    return cats.map((c) => ({
      ...c,
      percent: (c.revenue / totalRevenue) * 100,
    }))
  }, [productsQuery.data])

  // Payment breakdown with percentages
  const paymentData = useMemo(() => {
    const pb = summaryQuery.data?.paymentBreakdown ?? { cash: 0, qris: 0, card: 0 }
    const total = pb.cash + pb.qris + pb.card
    return [
      {
        key: "cash" as const,
        label: "Tunai",
        amount: pb.cash,
        percent: total > 0 ? (pb.cash / total) * 100 : 0,
        color: "bg-emerald-500",
        icon: <Wallet className="h-3.5 w-3.5" />,
      },
      {
        key: "qris" as const,
        label: "QRIS",
        amount: pb.qris,
        percent: total > 0 ? (pb.qris / total) * 100 : 0,
        color: "bg-teal-500",
        icon: <QrCode className="h-3.5 w-3.5" />,
      },
      {
        key: "card" as const,
        label: "Kartu",
        amount: pb.card,
        percent: total > 0 ? (pb.card / total) * 100 : 0,
        color: "bg-amber-500",
        icon: <CreditCard className="h-3.5 w-3.5" />,
      },
    ]
  }, [summaryQuery.data])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b bg-card px-4 py-4 sm:px-6 shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">Laporan & Analitik</h1>
          </div>

          <div className="flex items-center gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px] h-9" aria-label="Pilih periode">
                <CalendarRange className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={handleRefresh}
              aria-label="Segarkan data"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {isLoading ? (
          <ReportsSkeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {/* KPI cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard
                icon={<DollarSign className="h-5 w-5" />}
                iconColor="bg-primary/10 text-primary"
                label="Total Pendapatan"
                value={formatCurrency(summaryQuery.data?.totalRevenue ?? 0)}
                sub={`${formatNumber(summaryQuery.data?.totalTransactions ?? 0)} transaksi`}
              />
              <KpiCard
                icon={<TrendingUp className="h-5 w-5" />}
                iconColor="bg-emerald-500/10 text-emerald-600"
                label="Total Keuntungan"
                value={formatCurrency(summaryQuery.data?.totalProfit ?? 0)}
                sub={`Modal: ${formatCurrency(summaryQuery.data?.totalCost ?? 0)}`}
              />
              <KpiCard
                icon={<ShoppingBag className="h-5 w-5" />}
                iconColor="bg-amber-500/10 text-amber-600"
                label="Total Transaksi"
                value={formatNumber(summaryQuery.data?.totalTransactions ?? 0)}
                sub={`${formatNumber(summaryQuery.data?.totalItemsSold ?? 0)} item terjual`}
              />
              <KpiCard
                icon={<BarChart3 className="h-5 w-5" />}
                iconColor="bg-rose-500/10 text-rose-600"
                label="Rata-rata / Transaksi"
                value={formatCurrency(summaryQuery.data?.avgTransaction ?? 0)}
                sub="per transaksi"
              />
            </section>

            {/* Revenue trend */}
            <Card className="p-4 sm:p-5 gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Tren Pendapatan
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {days} hari terakhir
                  </p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={salesQuery.data ?? []}
                    margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => formatShortDate(d)}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={(v) => abbreviateCurrency(Number(v))}
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                    />
                    <Tooltip content={<RevenueTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Pendapatan"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      name="Keuntungan"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      fill="url(#profitGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Two-column: Top products + Category breakdown */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Top products */}
              <Card className="p-4 sm:p-5 gap-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Produk Terlaris
                </h2>
                <p className="text-xs text-muted-foreground">
                  Berdasarkan jumlah unit terjual
                </p>
                {topProducts.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    Belum ada produk terjual
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topProducts}
                        layout="vertical"
                        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="productName"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={110}
                          tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 15) + "…" : v)}
                        />
                        <Tooltip content={<ProductTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                        <Bar dataKey="qty" name="Unit" radius={[0, 4, 4, 0]}>
                          {topProducts.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Category breakdown */}
              <Card className="p-4 sm:p-5 gap-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-primary" />
                  Penjualan per Kategori
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pangsa pendapatan per kategori
                </p>
                {categoryData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                    Belum ada data kategori
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CategoryTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </section>

            {/* Payment breakdown + Inventory insights */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Payment breakdown */}
              <Card className="p-4 sm:p-5 gap-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  Metode Pembayaran
                </h2>
                <div className="space-y-3">
                  {paymentData.map((p) => (
                    <div key={p.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", p.color, "text-white")}>
                            {p.icon}
                          </span>
                          {p.label}
                        </span>
                        <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={p.percent} className={cn("h-2 flex-1", p.color.replace("bg-", "bg-"))} />
                        <span className="text-xs text-muted-foreground w-12 text-right font-mono">
                          {p.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Inventory insights */}
              <Card className="p-4 sm:p-5 gap-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  Wawasan Inventori
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <InsightTile
                    icon={<Package className="h-4 w-4" />}
                    iconColor="bg-primary/10 text-primary"
                    label="Total Produk"
                    value={formatNumber(summaryQuery.data?.totalProducts ?? 0)}
                  />
                  <InsightTile
                    icon={<DollarSign className="h-4 w-4" />}
                    iconColor="bg-emerald-500/10 text-emerald-600"
                    label="Nilai Inventory"
                    value={formatCurrency(summaryQuery.data?.inventoryValue ?? 0)}
                  />
                  <InsightTile
                    icon={<AlertTriangle className="h-4 w-4" />}
                    iconColor="bg-amber-500/10 text-amber-600"
                    label="Stok Menipis"
                    value={formatNumber(summaryQuery.data?.lowStockCount ?? 0)}
                  />
                  <InsightTile
                    icon={<PackageX className="h-4 w-4" />}
                    iconColor="bg-rose-500/10 text-rose-600"
                    label="Stok Habis"
                    value={formatNumber(summaryQuery.data?.outOfStockCount ?? 0)}
                  />
                </div>
              </Card>
            </section>

            {/* Daily breakdown table */}
            <Card className="py-0 gap-0">
              <div className="px-4 sm:px-5 py-4 flex items-center justify-between border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-primary" />
                  Rincian Harian
                </h2>
                <span className="text-xs text-muted-foreground">{days} hari terakhir</span>
              </div>
              {dailyBreakdown.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Belum ada data harian.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow className="bg-muted/40">
                        <TableHead className="pl-5">Tanggal</TableHead>
                        <TableHead className="text-center">Transaksi</TableHead>
                        <TableHead className="text-center">Item</TableHead>
                        <TableHead className="text-right">Pendapatan</TableHead>
                        <TableHead className="text-right pr-5">Keuntungan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyBreakdown.map((d) => (
                        <TableRow key={d.date} className="hover:bg-muted/30">
                          <TableCell className="pl-5 text-sm">
                            {formatShortDate(d.date)}
                          </TableCell>
                          <TableCell className="text-center text-sm font-mono">
                            {d.transactions}
                          </TableCell>
                          <TableCell className="text-center text-sm font-mono">
                            {d.items}
                          </TableCell>
                          <TableCell className="text-right text-sm font-semibold">
                            {formatCurrency(d.revenue)}
                          </TableCell>
                          <TableCell className="text-right pr-5 text-sm font-medium text-emerald-600">
                            {formatCurrency(d.profit)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

/* --------------------------- Sub-components --------------------------- */

function KpiCard({
  icon, iconColor, label, value, sub,
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
  sub: string
}) {
  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full", iconColor)}>
          {icon}
        </span>
      </div>
      <p className="text-lg sm:text-2xl font-bold tracking-tight truncate">{value}</p>
      <p className="text-[11px] text-muted-foreground truncate">{sub}</p>
    </Card>
  )
}

function InsightTile({
  icon, iconColor, label, value,
}: {
  icon: React.ReactNode
  iconColor: string
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full", iconColor)}>
          {icon}
        </span>
      </div>
      <p className="text-base font-bold tracking-tight truncate">{value}</p>
    </div>
  )
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold">Belum ada data penjualan pada periode ini.</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Coba pilih periode yang lebih lama atau buat transaksi baru untuk melihat
        laporan analitik Anda.
      </p>
    </Card>
  )
}
