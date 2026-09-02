import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const days = Number(searchParams.get("days") || "7")

    const today = new Date()
    const start = new Date(today.getTime() - (days - 1) * 86400000)
    start.setHours(0, 0, 0, 0)
    const end = new Date(today)
    end.setHours(23, 59, 59, 999)

    const sales = await db.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { items: true },
    })

    const totalRevenue = sales.reduce((s, x) => s + x.total, 0)
    const totalTransactions = sales.length
    const totalItemsSold = sales.reduce((s, x) => s + x.items.reduce((a, i) => a + i.qty, 0), 0)
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0
    let totalCost = 0
    for (const sale of sales) totalCost += sale.items.reduce((s, i) => s + i.cost * i.qty, 0)
    const totalProfit = totalRevenue - totalCost

    const allProducts = await db.product.findMany({ where: { isActive: true }, include: { category: true } })
    const lowStockProducts = allProducts.filter((p) => p.stock <= p.minStock && p.stock > 0)
    const outOfStockProducts = allProducts.filter((p) => p.stock === 0)

    const inventoryValue = allProducts.reduce((s, p) => s + p.price * p.stock, 0)
    const inventoryCost = allProducts.reduce((s, p) => s + p.cost * p.stock, 0)

    const cashSales = sales.filter((s) => s.paymentMethod === "cash").reduce((s, x) => s + x.total, 0)
    const qrisSales = sales.filter((s) => s.paymentMethod === "qris").reduce((s, x) => s + x.total, 0)
    const cardSales = sales.filter((s) => s.paymentMethod === "card").reduce((s, x) => s + x.total, 0)

    return NextResponse.json({
      period: { start, end },
      totalRevenue, totalTransactions, totalItemsSold, avgTransaction, totalProfit, totalCost,
      lowStockCount: lowStockProducts.length, outOfStockCount: outOfStockProducts.length,
      totalProducts: allProducts.length, inventoryValue, inventoryCost,
      paymentBreakdown: { cash: cashSales, qris: qrisSales, card: cardSales },
      lowStockProducts: [...lowStockProducts, ...outOfStockProducts].slice(0, 10),
    })
  } catch (error) {
    console.error("GET /api/reports/summary error:", error)
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 })
  }
}
