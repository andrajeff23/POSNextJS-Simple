import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { type, reason, qty, note } = await req.json()

    if (!type || !["in", "out", "adjustment"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }
    if (!reason) return NextResponse.json({ error: "Reason is required" }, { status: 400 })
    if (qty == null || qty === 0) return NextResponse.json({ error: "Quantity required" }, { status: 400 })

    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const numQty = Number(qty)
    let actualChange = numQty
    if (type === "out") actualChange = -Math.abs(numQty)
    if (type === "in") actualChange = Math.abs(numQty)
    if (type === "adjustment") actualChange = numQty

    const newBalance = product.stock + actualChange
    if (newBalance < 0) return NextResponse.json({ error: "Stock cannot be negative" }, { status: 400 })

    const updated = await db.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id }, data: { stock: newBalance }, include: { category: true } })
      await tx.stockMovement.create({
        data: { productId: id, type, reason, qty: actualChange, balance: newBalance, note: note || null },
      })
      return p
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/stock/[id] error:", error)
    return NextResponse.json({ error: "Failed to adjust stock" }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const movements = await db.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" }, take: 50,
    })
    return NextResponse.json(movements)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stock movements" }, { status: 500 })
  }
}
