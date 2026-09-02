import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: { include: { product: { include: { category: true } } } } },
    })
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 })
    return NextResponse.json(sale)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 })
  }
}
