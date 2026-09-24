import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Cart, CartItem, Product } from '../types'

interface CartContextValue {
  cart: Cart
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  itemCount: number
}

const CartContext = createContext<CartContextValue | null>(null)

const emptyCart = (): Cart => ({
  items: [],
  subtotal: 0,
  discount: 0,
  total: 0,
  updatedAt: new Date().toISOString(),
})

function recalc(items: CartItem[], discount = 0): Cart {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
  return {
    items,
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    updatedAt: new Date().toISOString(),
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart)

  const addItem = useCallback((product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.items.find(i => i.productId === product.id)
      let items: CartItem[]
      if (existing) {
        items = prev.items.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
        )
      } else {
        items = [...prev.items, {
          productId: product.id,
          product,
          quantity,
          price: product.promotionalPrice ?? product.price,
        }]
      }
      return recalc(items, prev.discount)
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart(prev => recalc(prev.items.filter(i => i.productId !== productId), prev.discount))
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart(prev => {
      if (quantity <= 0) return recalc(prev.items.filter(i => i.productId !== productId), prev.discount)
      return recalc(prev.items.map(i => i.productId === productId ? { ...i, quantity } : i), prev.discount)
    })
  }, [])

  const clearCart = useCallback(() => setCart(emptyCart()), [])

  return (
    <CartContext.Provider value={{
      cart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      itemCount: cart.items.reduce((acc, i) => acc + i.quantity, 0),
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
