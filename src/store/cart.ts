"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  productId: string
  name: string
  price: number
  cost: number
  image: string | null
  stock: number
  qty: number
}

interface CartState {
  items: CartItem[]
  discount: number
  customerName: string
  addItem: (product: { id: string; name: string; price: number; cost: number; image: string | null; stock: number }) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clear: () => void
  setDiscount: (amount: number) => void
  setCustomerName: (name: string) => void
  getSubtotal: () => number
  getTotal: () => number
  getItemCount: () => number
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      customerName: "",
      addItem: (product) => {
        const existing = get().items.find((i) => i.productId === product.id)
        if (existing) {
          if (existing.qty >= product.stock) return
          set({ items: get().items.map((i) => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i) })
        } else {
          set({ items: [...get().items, { productId: product.id, name: product.name, price: product.price, cost: product.cost, image: product.image, stock: product.stock, qty: 1 }] })
        }
      },
      removeItem: (productId) => set({ items: get().items.filter((i) => i.productId !== productId) }),
      updateQty: (productId, qty) => {
        if (qty <= 0) { set({ items: get().items.filter((i) => i.productId !== productId) }); return }
        set({ items: get().items.map((i) => i.productId === productId ? { ...i, qty: Math.min(qty, i.stock) } : i) })
      },
      clear: () => set({ items: [], discount: 0, customerName: "" }),
      setDiscount: (amount) => set({ discount: Math.max(0, amount) }),
      setCustomerName: (name) => set({ customerName: name }),
      getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      getTotal: () => Math.max(0, get().items.reduce((sum, i) => sum + i.price * i.qty, 0) - get().discount),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "pos-cart" }
  )
)
