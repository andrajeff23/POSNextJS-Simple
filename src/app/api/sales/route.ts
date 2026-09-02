import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = Number(searchParams.get("limit") || "50")

    const where: any = {}
    if (search) {
      where.OR = [{ invoiceNo: { contains: search } }, { customerName: { contains: search } }]
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); where.createdAt.lte = e }
    }

    const sales = await db.sale.findMany({
      where, include: { items: { include: { product: true } } },
      orderBy: { createdAt: "desc" }, take: limit,
    })
    return NextResponse.json(sales)
  } catch (error) {
    console.error("GET /api/sales error:", error)
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    const body = await req.json()
    const { items, discount, paidAmount, paymentMethod, customerName, note } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Keranjang kosong" }, { status: 400 })
    }

    const productIds = items.map((i: any) => i.productId)
    const products = await db.product.findMany({ where: { id: { in: productIds } } })

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: "Beberapa produk tidak ditemukan" }, { status: 400 })
    }

    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId)
      if (!prod) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 400 })
      if (prod.stock < item.qty) {
        return NextResponse.json({ error: `Stok ${prod.name} tidak cukup` }, { status: 400 })
      }
    }

    let subtotal = 0
    const saleItems = items.map((item: any) => {
      const prod = products.find((p) => p.id === item.productId)!
      const itemSubtotal = prod.price * item.qty
      subtotal += itemSubtotal
      return { productId: item.productId, qty: item.qty, price: prod.price, cost: prod.cost, subtotal: itemSubtotal }
    })

    const discountAmt = Number(discount) || 0
    const total = Math.max(0, subtotal - discountAmt)
    const paid = Number(paidAmount) || 0
    const change = paid - total

    if (paid < total) {
      return NextResponse.json({ error: "Jumlah bayar kurang dari total" }, { status: 400 })
    }

    const today = new Date()
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`
    const countToday = await db.sale.count({
      where: { createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) } },
    })
    const invoiceNo = `INV${dateStr}-${String(countToday + 1).padStart(4, "0")}`

    const sale = await db.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          invoiceNo, subtotal, discount: discountAmt, total, paidAmount: paid, changeAmount: change,
          paymentMethod: paymentMethod || "cash", customerName: customerName || null, note: note || null,
          cashierId: session?.id || null, cashierName: session?.name || null,
          items: { create: saleItems },
        },
        include: { items: { include: { product: true } } },
      })

      for (const item of saleItems) {
        const prod = products.find((p) => p.id === item.productId)!
        const newStock = prod.stock - item.qty
        await tx.product.update({ where: { id: item.productId }, data: { stock: newStock } })
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "out", reason: "sale", qty: -item.qty, balance: newStock, refId: created.id, note: `Penjualan ${invoiceNo}` },
        })
      }
      return created
    })

    return NextResponse.json(sale, { status: 201 })
  } catch (error) {
    console.error("POST /api/sales error:", error)
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 })
  }
}
