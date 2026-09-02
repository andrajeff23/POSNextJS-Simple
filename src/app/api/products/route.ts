import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get("search") || ""
    const categoryId = searchParams.get("categoryId") || ""
    const lowStock = searchParams.get("lowStock") === "true"

    const where: any = { isActive: true }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ]
    }
    if (categoryId) where.categoryId = categoryId

    let products = await db.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    })

    if (lowStock) {
      products = products.filter((p) => p.stock <= p.minStock)
    }

    return NextResponse.json(products)
  } catch (error) {
    console.error("GET /api/products error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, sku, barcode, description, price, cost, stock, minStock, unit, image, categoryId } = body

    if (!name || price == null || !categoryId) {
      return NextResponse.json({ error: "Name, price, and category are required" }, { status: 400 })
    }

    const product = await db.product.create({
      data: {
        name, sku: sku || null, barcode: barcode || null, description: description || null,
        price: Number(price), cost: Number(cost) || 0, stock: Number(stock) || 0,
        minStock: Number(minStock) || 5, unit: unit || "pcs", image: image || null, categoryId,
      },
      include: { category: true },
    })

    if (Number(stock) > 0) {
      await db.stockMovement.create({
        data: { productId: product.id, type: "in", reason: "initial", qty: Number(stock), balance: Number(stock), note: "Stok awal" },
      })
    }

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error("POST /api/products error:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
