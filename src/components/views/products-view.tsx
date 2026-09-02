"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Search, Plus, Pencil, Trash2, MoreHorizontal, Package, CheckCircle2,
  AlertTriangle, PackageX, Tag, Loader2, X, Settings2, FolderTree, Inbox,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

// ---------- Types ----------
interface Category {
  id: string
  name: string
  icon: string | null
  color: string
  _count?: { products: number }
}

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
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

interface ProductForm {
  name: string
  sku: string
  barcode: string
  description: string
  price: string
  cost: string
  stock: string
  minStock: string
  unit: string
  image: string
  categoryId: string
  isActive: boolean
}

const EMPTY_FORM: ProductForm = {
  name: "", sku: "", barcode: "", description: "",
  price: "", cost: "", stock: "0", minStock: "5",
  unit: "pcs", image: "", categoryId: "", isActive: true,
}

const CATEGORY_COLORS: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  emerald: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  amber: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  rose: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  violet: "bg-violet-100 text-violet-700 hover:bg-violet-100",
  orange: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  teal: "bg-teal-100 text-teal-700 hover:bg-teal-100",
}

function categoryBadgeClass(color: string) {
  return CATEGORY_COLORS[color] || CATEGORY_COLORS.slate
}

// ---------- Component ----------
export function ProductsView() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [categoryId, setCategoryId] = useState<string>("all")

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", debounced, categoryId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debounced) params.set("search", debounced)
      if (categoryId && categoryId !== "all") params.set("categoryId", categoryId)
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

  // Stats
  const stats = useMemo(() => {
    const total = products.length
    const active = products.filter((p) => p.isActive).length
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length
    const outOfStock = products.filter((p) => p.stock === 0).length
    return { total, active, lowStock, outOfStock }
  }, [products])

  // Dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, categoryId: categories[0]?.id || "" })
    setFormOpen(true)
  }

  const openEdit = (p: Product) => {
    setEditing(p)
    setForm({
      name: p.name,
      sku: p.sku || "",
      barcode: p.barcode || "",
      description: p.description || "",
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      minStock: String(p.minStock),
      unit: p.unit || "pcs",
      image: p.image || "",
      categoryId: p.categoryId,
      isActive: p.isActive,
    })
    setFormOpen(true)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nama produk wajib diisi")
      if (!form.categoryId) throw new Error("Kategori wajib dipilih")
      const price = Number(form.price)
      if (!form.price || isNaN(price) || price < 0) throw new Error("Harga jual tidak valid")

      const body = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        description: form.description.trim() || null,
        price,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
        unit: form.unit || "pcs",
        image: form.image.trim() || null,
        categoryId: form.categoryId,
        isActive: form.isActive,
      }

      if (editing) {
        const res = await fetch(`/api/products/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui produk")
        return data
      } else {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal membuat produk")
        return data
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Produk diperbarui" : "Produk ditambahkan")
      setFormOpen(false)
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["categories"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghapus produk")
      return data
    },
    onSuccess: () => {
      toast.success("Produk dihapus")
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["categories"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Manajemen Produk</h1>
          <p className="text-sm text-muted-foreground">Kelola katalog produk Anda</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)} className="h-9">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Kategori</span>
          </Button>
          <Button size="sm" onClick={openCreate} className="h-9">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tambah Produk</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Produk" value={formatNumber(stats.total)} icon={<Package className="h-4 w-4" />} tone="default" />
        <StatCard label="Produk Aktif" value={formatNumber(stats.active)} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Stok Menipis" value={formatNumber(stats.lowStock)} icon={<AlertTriangle className="h-4 w-4" />} tone="amber" />
        <StatCard label="Stok Habis" value={formatNumber(stats.outOfStock)} icon={<PackageX className="h-4 w-4" />} tone="rose" />
      </div>

      {/* Filters */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, SKU, atau barcode..."
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
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-full sm:w-48 h-9">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="mr-1">{c.icon || "📦"}</span>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <ProductsSkeleton />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10 text-muted-foreground/40" />}
          title={search || categoryId !== "all" ? "Produk tidak ditemukan" : "Belum ada produk"}
          description={search || categoryId !== "all" ? "Coba ubah filter pencarian" : "Tambahkan produk pertama Anda untuk memulai"}
          action={!search && categoryId === "all" ? (
            <Button size="sm" onClick={openCreate} className="mt-3">
              <Plus className="h-4 w-4" /> Tambah Produk
            </Button>
          ) : undefined}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[28%]">Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Harga Jual</TableHead>
                  <TableHead className="text-right">Harga Beli</TableHead>
                  <TableHead className="text-center">Stok</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-12 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDeleteTarget(p)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {products.map((p) => (
              <ProductCardMobile
                key={p.id}
                product={p}
                onEdit={() => openEdit(p)}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>
        </>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
            <DialogDescription>
              {editing ? "Perbarui informasi produk" : "Isi informasi produk baru"}
            </DialogDescription>
          </DialogHeader>
          <ProductFormView
            form={form}
            setForm={setForm}
            categories={categories}
            isEdit={!!editing}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk <strong className="text-foreground">{deleteTarget?.name}</strong> akan dinonaktifkan.
              Anda bisa memulihkannya nanti dari database. Tindakan ini tidak dapat dibatalkan dari antarmuka.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management */}
      <CategoryDialog open={categoryOpen} onOpenChange={setCategoryOpen} categories={categories} />
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
          <p className="text-lg font-bold leading-tight mt-0.5">{value}</p>
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

function StockBadge({ stock, minStock, unit }: { stock: number; minStock: number; unit: string }) {
  if (stock === 0) {
    return <Badge variant="destructive" className="text-[10px]">Habis</Badge>
  }
  if (stock <= minStock) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", stockColor(stock, minStock))}>
        {formatNumber(stock)} {unit}
        <AlertTriangle className="h-3 w-3" />
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", stockColor(stock, minStock))}>
      {formatNumber(stock)} {unit}
    </span>
  )
}

// ---------- Product Row (Desktop) ----------
function ProductRow({
  product, onEdit, onDelete,
}: { product: Product; onEdit: () => void; onDelete: () => void }) {
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
              {product.sku ? `SKU: ${product.sku}` : product.barcode ? product.barcode : "—"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {product.category ? (
          <Badge variant="secondary" className={cn("text-[10px] gap-1", categoryBadgeClass(product.category.color))}>
            <span>{product.category.icon || "📦"}</span>
            {product.category.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium">{formatCurrency(product.price)}</TableCell>
      <TableCell className="text-right text-muted-foreground">{formatCurrency(product.cost)}</TableCell>
      <TableCell className="text-center">
        <StockBadge stock={product.stock} minStock={product.minStock} unit={product.unit} />
      </TableCell>
      <TableCell className="text-center">
        {product.isActive ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">
            Aktif
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">
            Nonaktif
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

// ---------- Product Card (Mobile) ----------
function ProductCardMobile({
  product, onEdit, onDelete,
}: { product: Product; onEdit: () => void; onDelete: () => void }) {
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
              <p className="text-[11px] text-muted-foreground">
                {product.sku ? `SKU: ${product.sku}` : product.barcode || "—"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {product.category && (
              <Badge variant="secondary" className={cn("text-[10px] gap-0.5", categoryBadgeClass(product.category.color))}>
                <span>{product.category.icon || "📦"}</span>
                {product.category.name}
              </Badge>
            )}
            {product.isActive ? (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]">Aktif</Badge>
            ) : (
              <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px]">Nonaktif</Badge>
            )}
          </div>
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-sm font-bold text-primary">{formatCurrency(product.price)}</p>
              <p className="text-[10px] text-muted-foreground">Beli: {formatCurrency(product.cost)}</p>
            </div>
            <div className="text-right">
              <p className={cn("text-sm font-bold", stockColor(product.stock, product.minStock))}>
                {formatNumber(product.stock)} <span className="text-[10px] font-normal text-muted-foreground">{product.unit}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">Min: {product.minStock}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ---------- Product Form ----------
function ProductFormView({
  form, setForm, categories, isEdit,
}: {
  form: ProductForm
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>
  categories: Category[]
  isEdit: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Name */}
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor="p-name">Nama Produk <span className="text-destructive">*</span></Label>
        <Input
          id="p-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Contoh: Kopi Susu Latte"
        />
      </div>

      {/* SKU */}
      <div className="space-y-1.5">
        <Label htmlFor="p-sku">SKU</Label>
        <Input
          id="p-sku"
          value={form.sku}
          onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
          placeholder="Kode unik (opsional)"
        />
      </div>

      {/* Barcode */}
      <div className="space-y-1.5">
        <Label htmlFor="p-barcode">Barcode</Label>
        <Input
          id="p-barcode"
          value={form.barcode}
          onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
          placeholder="Kode barcode (opsional)"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Kategori <span className="text-destructive">*</span></Label>
        <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            {categories.length === 0 ? (
              <SelectItem value="_none" disabled>Belum ada kategori</SelectItem>
            ) : (
              categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="mr-1">{c.icon || "📦"}</span>
                  {c.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        {categories.length === 0 && (
          <p className="text-xs text-amber-600">Tambahkan kategori terlebih dahulu</p>
        )}
      </div>

      {/* Unit */}
      <div className="space-y-1.5">
        <Label htmlFor="p-unit">Satuan</Label>
        <Input
          id="p-unit"
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          placeholder="pcs"
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label htmlFor="p-price">Harga Jual <span className="text-destructive">*</span></Label>
        <Input
          id="p-price"
          type="number"
          min={0}
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          placeholder="0"
        />
      </div>

      {/* Cost */}
      <div className="space-y-1.5">
        <Label htmlFor="p-cost">Harga Beli</Label>
        <Input
          id="p-cost"
          type="number"
          min={0}
          value={form.cost}
          onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
          placeholder="0"
        />
      </div>

      {/* Stock */}
      <div className="space-y-1.5">
        <Label htmlFor="p-stock">Stok {isEdit && "(ubah = penyesuaian)"}</Label>
        <Input
          id="p-stock"
          type="number"
          min={0}
          value={form.stock}
          onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
          placeholder="0"
        />
      </div>

      {/* Min Stock */}
      <div className="space-y-1.5">
        <Label htmlFor="p-min">Stok Minimum</Label>
        <Input
          id="p-min"
          type="number"
          min={0}
          value={form.minStock}
          onChange={(e) => setForm((f) => ({ ...f, minStock: e.target.value }))}
          placeholder="5"
        />
      </div>

      {/* Emoji / Image */}
      <div className="space-y-1.5">
        <Label htmlFor="p-image">Emoji / Ikon</Label>
        <Input
          id="p-image"
          value={form.image}
          onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
          placeholder="contoh: ☕ atau 🍪"
          maxLength={4}
        />
      </div>

      {/* Active */}
      <div className="space-y-1.5">
        <Label htmlFor="p-active">Status Aktif</Label>
        <div className="flex items-center gap-2 h-9">
          <Switch
            id="p-active"
            checked={form.isActive}
            onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          />
          <span className="text-sm text-muted-foreground">
            {form.isActive ? "Aktif" : "Nonaktif"}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor="p-desc">Deskripsi</Label>
        <Textarea
          id="p-desc"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Deskripsi produk (opsional)"
          rows={2}
        />
      </div>
    </div>
  )
}

// ---------- Category Dialog ----------
function CategoryDialog({
  open, onOpenChange, categories,
}: { open: boolean; onOpenChange: (v: boolean) => void; categories: Category[] }) {
  const qc = useQueryClient()
  const [catForm, setCatForm] = useState({ name: "", icon: "📦", color: "slate" })
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [deleteCat, setDeleteCat] = useState<Category | null>(null)

  useEffect(() => {
    if (!open) {
      setCatForm({ name: "", icon: "📦", color: "slate" })
      setEditingCat(null)
    }
  }, [open])

  const startEditCat = (c: Category) => {
    setEditingCat(c)
    setCatForm({ name: c.name, icon: c.icon || "📦", color: c.color || "slate" })
  }

  const saveCatMut = useMutation({
    mutationFn: async () => {
      if (!catForm.name.trim()) throw new Error("Nama kategori wajib diisi")
      const body = { name: catForm.name.trim(), icon: catForm.icon || null, color: catForm.color }
      if (editingCat) {
        const res = await fetch(`/api/categories/${editingCat.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal memperbarui kategori")
        return data
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Gagal membuat kategori")
        return data
      }
    },
    onSuccess: () => {
      toast.success(editingCat ? "Kategori diperbarui" : "Kategori ditambahkan")
      setCatForm({ name: "", icon: "📦", color: "slate" })
      setEditingCat(null)
      qc.invalidateQueries({ queryKey: ["categories"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteCatMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal menghapus kategori")
      return data
    },
    onSuccess: () => {
      toast.success("Kategori dihapus")
      setDeleteCat(null)
      qc.invalidateQueries({ queryKey: ["categories"] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" /> Manajemen Kategori
            </DialogTitle>
            <DialogDescription>Tambah, ubah, atau hapus kategori produk</DialogDescription>
          </DialogHeader>

          {/* Form */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="c-name">Nama Kategori</Label>
              <Input
                id="c-name"
                value={catForm.name}
                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contoh: Minuman"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-icon">Ikon (emoji)</Label>
              <Input
                id="c-icon"
                value={catForm.icon}
                onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="📦"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <Select value={catForm.color} onValueChange={(v) => setCatForm((f) => ({ ...f, color: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORY_COLORS).map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setCatForm({ name: "", icon: "📦", color: "slate" }); setEditingCat(null) }}
                disabled={!editingCat}
              >
                Batal Edit
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => saveCatMut.mutate()}
                disabled={saveCatMut.isPending}
              >
                {saveCatMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCat ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            <Label className="text-xs text-muted-foreground">Daftar Kategori ({categories.length})</Label>
            {categories.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Belum ada kategori
              </div>
            ) : (
              <div className="space-y-1">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border p-2 transition-colors",
                      editingCat?.id === c.id && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="text-lg">{c.icon || "📦"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {c._count?.products ?? 0} produk
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditCat(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteCat(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCat} onOpenChange={(open) => !open && setDeleteCat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCat && (deleteCat._count?.products ?? 0) > 0 ? (
                <>
                  Kategori <strong className="text-foreground">{deleteCat.name}</strong> masih memiliki{" "}
                  <strong className="text-foreground">{deleteCat._count?.products} produk aktif</strong>.
                  Pindahkan atau hapus produk terlebih dahulu sebelum menghapus kategori.
                </>
              ) : (
                <>Kategori <strong className="text-foreground">{deleteCat?.name}</strong> akan dihapus permanen.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCat && deleteCatMut.mutate(deleteCat.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={(deleteCat?._count?.products ?? 0) > 0 || deleteCatMut.isPending}
            >
              {deleteCatMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ---------- Skeleton ----------
function ProductsSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------- Empty State ----------
function EmptyState({
  icon, title, description, action,
}: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center">
      {icon}
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
      {action}
    </Card>
  )
}
