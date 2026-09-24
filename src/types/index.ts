// ─── Core Entity Types ────────────────────────────────────────────────────────

export type UserRole = 'customer' | 'staff' | 'admin'

export interface User {
  id: string
  email: string
  role: UserRole
  name: string
  lastName: string
  phone?: string
  avatar?: string
  company?: string
  document?: string
  documentType?: 'cpf' | 'cnpj'
  birthDate?: string
  address?: Address
  status: 'active' | 'inactive' | 'blocked'
  createdAt: string
  updatedAt: string
  lastAccessAt?: string
}

export interface Address {
  street?: string
  number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  zipCode?: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  lastName: string
  email: string
  password: string
  phone?: string
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  parentId?: string
  order: number
  active: boolean
  createdAt: string
  updatedAt: string
}

// ─── Product ──────────────────────────────────────────────────────────────────

export type ProductType = 'physical' | 'digital' | 'equipment' | 'package'

export interface Product {
  id: string
  name: string
  slug: string
  sku?: string
  description: string
  shortDescription?: string
  categoryId?: string
  subcategoryId?: string
  type: ProductType
  price: number
  promotionalPrice?: number
  stock: number
  images: string[]
  videos?: string[]
  featured: boolean
  active: boolean
  status: 'draft' | 'published' | 'archived'
  specifications?: Record<string, string>
  createdAt: string
  updatedAt: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

export type PriceType = 'fixed' | 'starting_at' | 'quote'

export interface Service {
  id: string
  name: string
  slug: string
  categoryId?: string
  shortDescription?: string
  description: string
  priceType: PriceType
  price?: number
  startingPrice?: number
  images: string[]
  videos?: string[]
  estimatedDelivery?: string
  featured: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  product: Product
  quantity: number
  price: number
}

export interface Cart {
  id?: string
  customerId?: string
  items: CartItem[]
  subtotal: number
  discount: number
  total: number
  updatedAt: string
}

// ─── Order ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'processing'
  | 'in_production'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customer?: Pick<User, 'name' | 'lastName' | 'email' | 'avatar'>
  items: OrderItem[]
  subtotal: number
  discount: number
  total: number
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentId?: string
  shippingAddress?: Address
  billingAddress?: Address
  notes?: string
  conversationId?: string
  createdAt: string
  updatedAt: string
}

// ─── Quote ────────────────────────────────────────────────────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

export interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Quote {
  id: string
  quoteNumber: string
  customerId: string
  customer?: Pick<User, 'name' | 'lastName' | 'email'>
  items: QuoteItem[]
  description?: string
  subtotal: number
  discount: number
  total: number
  status: QuoteStatus
  validUntil?: string
  createdAt: string
  updatedAt: string
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export type PaymentMethod = 'pix' | 'credit_card' | 'bank_slip'
export type PaymentProvider = 'asaas' | 'manual' | 'stripe'

export interface Payment {
  id: string
  orderId: string
  customerId: string
  provider: PaymentProvider
  providerPaymentId?: string
  method: PaymentMethod
  amount: number
  status: PaymentStatus
  pixCode?: string
  pixQrCode?: string
  invoiceUrl?: string
  paidAt?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ─── Conversation & Messages ───────────────────────────────────────────────────

export type MessageType =
  | 'text'
  | 'image'
  | 'pdf'
  | 'document'
  | 'video'
  | 'audio'
  | 'voice'
  | 'order_card'
  | 'quote_card'
  | 'payment_card'
  | 'service_card'
  | 'system'

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

export interface MessageAttachment {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  senderRole: UserRole
  senderName: string
  senderAvatar?: string
  type: MessageType
  content: string
  attachments?: MessageAttachment[]
  replyTo?: string
  metadata?: Record<string, unknown>
  status: MessageStatus
  createdAt: string
  updatedAt: string
  sentAt?: string
  deliveredAt?: string
  readAt?: string
  editedAt?: string
  deletedAt?: string
  deletedBy?: string
}

export interface Conversation {
  id: string
  participants: string[]
  customerId: string
  customerName: string
  customerAvatar?: string
  lastMessage?: string
  lastMessageAt?: string
  unreadCount: number
  orderId?: string
  serviceId?: string
  status: 'open' | 'closed' | 'archived'
  createdAt: string
  updatedAt: string
}

// ─── File ─────────────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
  customerId: string
  orderId?: string
  conversationId?: string
  serviceId?: string
  uploadedBy: string
  uploaderRole: UserRole
  category: 'order' | 'project' | 'conversation' | 'document'
  createdAt: string
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_message'
  | 'message_read'
  | 'order_created'
  | 'order_updated'
  | 'payment_confirmed'
  | 'payment_pending'
  | 'quote_received'
  | 'file_received'
  | 'new_post'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  referenceType?: string
  referenceId?: string
  read: boolean
  readAt?: string
  createdAt: string
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioProject {
  id: string
  title: string
  slug: string
  client?: string
  categoryId?: string
  description: string
  shortDescription?: string
  cover: string
  gallery?: string[]
  videos?: string[]
  services?: string[]
  date?: string
  featured: boolean
  active: boolean
  externalUrl?: string
  createdAt: string
  updatedAt: string
}

// ─── Community/Posts ──────────────────────────────────────────────────────────

export type PostType =
  | 'announcement'
  | 'news'
  | 'product'
  | 'service'
  | 'promotion'
  | 'project'
  | 'opportunity'

export interface Post {
  id: string
  authorId: string
  authorName: string
  authorRole: string
  authorAvatar?: string
  type: PostType
  title?: string
  content: string
  image?: string
  reactions: Record<string, number>
  myReaction?: string
  commentsCount: number
  featured: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Reaction {
  id: string
  postId: string
  userId: string
  emoji: string
  createdAt: string
}

// ─── Site Settings ────────────────────────────────────────────────────────────

export interface SiteSettings {
  companyName: string
  description: string
  logo?: string
  favicon?: string
  primaryColor: string
  accentColor: string
  heroHeadline: string
  heroSubheadline: string
  heroCta: string
  heroImage?: string
  socialLinks: {
    instagram?: string
    youtube?: string
    tiktok?: string
    linkedin?: string
    whatsapp?: string
  }
  contact: {
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
  }
  footerText?: string
  updatedAt: string
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  ip?: string
  userAgent?: string
  createdAt: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
