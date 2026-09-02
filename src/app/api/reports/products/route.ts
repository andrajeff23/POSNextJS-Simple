import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const days = Number(new URL(req.url).searchParams.get("days") || "7")
    const startDate = new Date(Date.now() - days * 86400000)

    const sales = await db.sale.findMany({
      where: { createdAt: { gte: startDate } },
      include: { items: { include: { product: { include: { category: true } } } } },
    })

    const productMap = new Map<string, { productId: string; productName: string; category: string; qty: number; revenue: number; profit: number }>()

    for (const sale of sales) {
      for (const item of sale.items) {
        const existing = productMap.get(item.productId) || {
          productId: item.productId, productName: item.product.name,
          category: item.product.category?.name || "-", qty: 0, revenue: 0, profit: 0,
        }
        existing.qty += item.qty
        existing.revenue += item.subtotal
        existing.profit += (item.price - item.cost) * item.qty
        productMap.set(item.productId, existing)
      }
    }

    const allProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty)

    const categoryMap = new Map<string, { name: string; revenue: number; qty: number }>()
    for (const p of allProducts) {
      const existing = categoryMap.get(p.category) || { name: p.category, revenue: 0, qty: 0 }
      existing.revenue += p.revenue
      existing.qty += p.qty
      categoryMap.set(p.category, existing)
    }

    return NextResponse.json({
      topProducts: allProducts.slice(0, 10),
      allProducts,
      byCategory: Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue),
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch product report" }, { status: 500 })
  }
}
