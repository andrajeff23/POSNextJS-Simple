import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, icon, color } = await req.json()
    const data: any = {}
    if (name !== undefined) data.name = name
    if (icon !== undefined) data.icon = icon || null
    if (color !== undefined) data.color = color
    const updated = await db.category.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const count = await db.product.count({ where: { categoryId: id, isActive: true } })
    if (count > 0) return NextResponse.json({ error: "Kategori masih memiliki produk" }, { status: 400 })
    await db.category.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
