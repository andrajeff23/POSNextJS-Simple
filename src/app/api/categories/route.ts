import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  })
  return NextResponse.json(categories)
}

export async function POST(req: NextRequest) {
  try {
    const { name, icon, color } = await req.json()
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    const category = await db.category.create({ data: { name, icon: icon || null, color: color || "slate" } })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error("POST /api/categories error:", error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
