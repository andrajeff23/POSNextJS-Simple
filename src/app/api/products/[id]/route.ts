import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, sku, barcode, description, price, cost, stock, minStock, unit, image, categoryId, isActive } = body

    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Product not found" }, { status: 404 })

    const data: any = {}
    if (name !== undefined) data.name = name
    if (sku !== undefined) data.sku = sku || null
    if (barcode !== undefined) data.barcode = barcode || null
    if (description !== undefined) data.description = description || null
    if (price !== undefined) data.price = Number(price)
    if (cost !== undefined) data.cost = Number(cost)
    if (minStock !== undefined) data.minStock = Number(minStock)
    if (unit !== undefined) data.unit = unit
    if (image !== undefined) data.image = image || null
    if (categoryId !== undefined) data.categoryId = categoryId
    if (isActive !== undefined) data.isActive = isActive

    if (stock !== undefined && Number(stock) !== existing.stock) {
      const diff = Number(stock) - existing.stock
      data.stock = Number(stock)
      const updated = await db.product.update({ where: { id }, data, include: { category: true } })
      await db.stockMovement.create({
        data: { productId: id, type: diff > 0 ? "in" : "out", reason: "adjustment", qty: diff, balance: Number(stock), note: "Penyesuaian manual" },
      })
      return NextResponse.json(updated)
    }

    const updated = await db.product.update({ where: { id }, data, include: { category: true } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("PUT /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.product.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error)
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 })
  }
}
