import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const days = Number(new URL(req.url).searchParams.get("days") || "7")
    const today = new Date()
    const startDate = new Date(today.getTime() - (days - 1) * 86400000)
    startDate.setHours(0, 0, 0, 0)

    const sales = await db.sale.findMany({
      where: { createdAt: { gte: startDate } },
      include: { items: true },
      orderBy: { createdAt: "asc" },
    })

    const dayMap = new Map<string, { date: string; revenue: number; transactions: number; items: number; profit: number }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate.getTime() + i * 86400000)
      const key = d.toISOString().split("T")[0]
      dayMap.set(key, { date: key, revenue: 0, transactions: 0, items: 0, profit: 0 })
    }

    for (const sale of sales) {
      const key = sale.createdAt.toISOString().split("T")[0]
      const entry = dayMap.get(key)
      if (entry) {
        entry.revenue += sale.total
        entry.transactions += 1
        entry.items += sale.items.reduce((a, i) => a + i.qty, 0)
        entry.profit += sale.total - sale.items.reduce((a, i) => a + i.cost * i.qty, 0)
      }
    }

    return NextResponse.json(Array.from(dayMap.values()))
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sales report" }, { status: 500 })
  }
}
