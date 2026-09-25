import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export interface CartProduct {
  id: string
  name: string
  slug: string
  price: number
  image?: string | null
  stock: number
}

export interface CartItem {
  productId: string
  product: CartProduct
  quantity: number
  price: number
}

export interface CartState {
  items: CartItem[]
  subtotal: number
  total: number
  updatedAt: string
}

interface CartContextValue {
  cart: CartState
  addItem: (product: CartProduct, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  itemCount: number
}

const STORAGE_KEY = 'playmoments_cart_v1'
const CartContext = createContext<CartContextValue | null>(null)

const emptyCart = (): CartState => ({
  items: [],
  subtotal: 0,
  total: 0,
  updatedAt: new Date().toISOString(),
})

function recalc(items: CartItem[]): CartState {
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  return { items, subtotal, total: subtotal, updatedAt: new Date().toISOString() }
}

function readCart(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyCart()
    const parsed = JSON.parse(raw) as CartState
    if (!Array.isArray(parsed.items)) return emptyCart()
    return recalc(parsed.items.filter(item =>
      item?.productId &&
      item?.product?.id === item.productId &&
      Number.isFinite(item.price) &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0,
    ))
  } catch {
    return emptyCart()
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(() => readCart())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  const addItem = useCallback((product: CartProduct, quantity = 1) => {
    const safeQuantity = Math.max(1, Math.min(quantity, product.stock || quantity))
    setCart(previous => {
      const existing = previous.items.find(item => item.productId === product.id)
      const items = existing
        ? previous.items.map(item => item.productId === product.id
          ? { ...item, quantity: Math.min(item.quantity + safeQuantity, product.stock || item.quantity + safeQuantity), product, price: product.price }
          : item)
        : [...previous.items, { productId: product.id, product, quantity: safeQuantity, price: product.price }]
      return recalc(items)
    })
  }, [])

  const removeItem = useCallback((productId: string) => {
    setCart(previous => recalc(previous.items.filter(item => item.productId !== productId)))
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setCart(previous => {
      if (quantity <= 0) return recalc(previous.items.filter(item => item.productId !== productId))
      const items = previous.items.map(item => item.productId === productId
        ? { ...item, quantity: Math.min(Math.max(1, quantity), item.product.stock || quantity) }
        : item)
      return recalc(items)
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
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within CartProvider')
  return context
}
