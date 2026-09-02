import { db } from "../src/lib/db"
import bcrypt from "bcryptjs"

async function main() {
  await db.stockMovement.deleteMany()
  await db.saleItem.deleteMany()
  await db.sale.deleteMany()
  await db.product.deleteMany()
  await db.category.deleteMany()
  await db.setting.deleteMany()
  await db.user.deleteMany()

  // Create users
  const adminPass = await bcrypt.hash("admin123", 10)
  const kasirPass = await bcrypt.hash("kasir123", 10)

  const admin = await db.user.create({
    data: { email: "admin@pos.com", name: "Administrator", passwordHash: adminPass, role: "admin" },
  })
  const kasir = await db.user.create({
    data: { email: "kasir@pos.com", name: "Kasir Satu", passwordHash: kasirPass, role: "cashier" },
  })

  console.log("Users created:")
  console.log("  Admin  - admin@pos.com / admin123")
  console.log("  Kasir  - kasir@pos.com / kasir123")

  // Categories
  const makanan = await db.category.create({ data: { name: "Makanan", icon: "🍔", color: "orange" } })
  const minuman = await db.category.create({ data: { name: "Minuman", icon: "🥤", color: "cyan" } })
  const snack = await db.category.create({ data: { name: "Snack", icon: "🍟", color: "amber" } })
  const dessert = await db.category.create({ data: { name: "Dessert", icon: "🍰", color: "pink" } })
  const kopi = await db.category.create({ data: { name: "Kopi", icon: "☕", color: "brown" } })

  const products = [
    { name: "Nasi Goreng Spesial", sku: "MKN001", price: 25000, cost: 15000, stock: 50, minStock: 10, categoryId: makanan.id, image: "🍛" },
    { name: "Mie Goreng", sku: "MKN002", price: 20000, cost: 12000, stock: 45, minStock: 10, categoryId: makanan.id, image: "🍜" },
    { name: "Ayam Bakar", sku: "MKN003", price: 30000, cost: 18000, stock: 30, minStock: 8, categoryId: makanan.id, image: "🍗" },
    { name: "Sate Ayam", sku: "MKN004", price: 28000, cost: 16000, stock: 25, minStock: 8, categoryId: makanan.id, image: "🍢" },
    { name: "Gado-Gado", sku: "MKN005", price: 22000, cost: 12000, stock: 35, minStock: 10, categoryId: makanan.id, image: "🥗" },
    { name: "Soto Ayam", sku: "MKN006", price: 23000, cost: 13000, stock: 4, minStock: 10, categoryId: makanan.id, image: "🍲" },
    { name: "Es Teh Manis", sku: "MNM001", price: 5000, cost: 2000, stock: 100, minStock: 20, categoryId: minuman.id, image: "🧋" },
    { name: "Teh Hangat", sku: "MNM002", price: 5000, cost: 2000, stock: 100, minStock: 20, categoryId: minuman.id, image: "🍵" },
    { name: "Air Mineral", sku: "MNM003", price: 4000, cost: 2500, stock: 150, minStock: 24, categoryId: minuman.id, image: "💧" },
    { name: "Jus Jeruk", sku: "MNM004", price: 12000, cost: 6000, stock: 40, minStock: 10, categoryId: minuman.id, image: "🍊" },
    { name: "Es Jeruk", sku: "MNM005", price: 8000, cost: 4000, stock: 60, minStock: 15, categoryId: minuman.id, image: "🥤" },
    { name: "Kentang Goreng", sku: "SNK001", price: 15000, cost: 7000, stock: 50, minStock: 10, categoryId: snack.id, image: "🍟" },
    { name: "Pisang Goreng", sku: "SNK002", price: 12000, cost: 5000, stock: 40, minStock: 10, categoryId: snack.id, image: "🍌" },
    { name: "Roti Bakar", sku: "SNK003", price: 14000, cost: 6000, stock: 0, minStock: 10, categoryId: snack.id, image: "🍞" },
    { name: "Pop Mie", sku: "SNK004", price: 10000, cost: 5000, stock: 55, minStock: 15, categoryId: snack.id, image: "🥡" },
    { name: "Es Krim Vanilla", sku: "DST001", price: 10000, cost: 4500, stock: 70, minStock: 15, categoryId: dessert.id, image: "🍨" },
    { name: "Puding Cokelat", sku: "DST002", price: 8000, cost: 3500, stock: 45, minStock: 10, categoryId: dessert.id, image: "🍮" },
    { name: "Cake Cokelat", sku: "DST003", price: 18000, cost: 9000, stock: 25, minStock: 8, categoryId: dessert.id, image: "🍰" },
    { name: "Kopi Hitam", sku: "KPI001", price: 8000, cost: 3000, stock: 80, minStock: 20, categoryId: kopi.id, image: "☕" },
    { name: "Cappuccino", sku: "KPI002", price: 18000, cost: 8000, stock: 60, minStock: 15, categoryId: kopi.id, image: "☕" },
    { name: "Cafe Latte", sku: "KPI003", price: 20000, cost: 9000, stock: 55, minStock: 15, categoryId: kopi.id, image: "☕" },
    { name: "Es Kopi Susu", sku: "KPI004", price: 15000, cost: 6000, stock: 70, minStock: 20, categoryId: kopi.id, image: "🧊" },
  ]

  for (const p of products) {
    await db.product.create({ data: p })
  }

  // Settings
  await db.setting.create({ data: { key: "storeName", value: "POS Kasir Pro" } })
  await db.setting.create({ data: { key: "storeAddress", value: "Jl. Merdeka No. 123, Jakarta" } })
  await db.setting.create({ data: { key: "storePhone", value: "0812-3456-7890" } })
  await db.setting.create({ data: { key: "currency", value: "Rp" } })

  // Sample sales
  const allProducts = await db.product.findMany()
  const now = new Date()
  for (let day = 0; day < 7; day++) {
    const salesCount = Math.floor(Math.random() * 4) + 2
    for (let s = 0; s < salesCount; s++) {
      const itemCount = Math.floor(Math.random() * 3) + 1
      const items: any[] = []
      let subtotal = 0
      for (let i = 0; i < itemCount; i++) {
        const prod = allProducts[Math.floor(Math.random() * allProducts.length)]
        const qty = Math.floor(Math.random() * 3) + 1
        const itemSubtotal = prod.price * qty
        items.push({ productId: prod.id, qty, price: prod.price, cost: prod.cost, subtotal: itemSubtotal })
        subtotal += itemSubtotal
      }
      const total = subtotal
      const paidAmount = Math.ceil(total / 5000) * 5000
      const saleDate = new Date(now.getTime() - day * 86400000 - s * 3600000)
      const sale = await db.sale.create({
        data: {
          invoiceNo: `INV${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, "0")}${String(saleDate.getDate()).padStart(2, "0")}-${String(day * 10 + s + 1).padStart(4, "0")}`,
          subtotal, total, paidAmount, changeAmount: paidAmount - total,
          paymentMethod: Math.random() > 0.5 ? "cash" : "qris",
          cashierName: kasir.name,
          createdAt: saleDate,
          items: { create: items },
        },
      })
      for (const item of items) {
        await db.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.qty } } })
        const prod = await db.product.findUnique({ where: { id: item.productId } })
        if (prod) {
          await db.stockMovement.create({
            data: { productId: item.productId, type: "out", reason: "sale", qty: -item.qty, balance: prod.stock, refId: sale.id },
          })
        }
      }
    }
  }

  console.log(`Seed done: 2 users, 5 categories, ${products.length} products`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
