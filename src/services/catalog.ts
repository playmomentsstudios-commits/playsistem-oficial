import { supabase } from '../lib/supabase'

export type ProductStatus = 'draft' | 'published' | 'archived'
export type ProductType = 'physical' | 'digital' | 'equipment' | 'package'
export type CommercialMode = 'sale' | 'rental' | 'sale_and_rental'

export interface ProductCategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  active: boolean
  display_order: number
}

export interface ProductImageRow {
  id: string
  product_id: string
  storage_path: string
  public_url: string | null
  alt_text: string | null
  display_order: number
  is_cover: boolean
}

export interface CatalogProductRow {
  id: string
  name: string
  slug: string
  sku: string | null
  short_description: string | null
  description: string
  category_id: string | null
  product_type: ProductType
  commercial_mode: CommercialMode
  sale_price: number | null
  promotional_price: number | null
  rental_daily_price: number | null
  stock: number
  featured: boolean
  active: boolean
  status: ProductStatus
  specifications: Record<string, string>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PublicCatalogProduct extends CatalogProductRow {
  product_images: ProductImageRow[]
}

export interface ProductInput {
  name: string
  slug: string
  sku?: string | null
  short_description?: string | null
  description: string
  category_id?: string | null
  product_type: ProductType
  commercial_mode: CommercialMode
  sale_price?: number | null
  promotional_price?: number | null
  rental_daily_price?: number | null
  stock: number
  featured: boolean
  active: boolean
  status: ProductStatus
}

export async function listCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []) as ProductCategoryRow[]
}

export async function listAdminProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []) as CatalogProductRow[]
}

export async function listPublicProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_images (
        id,
        product_id,
        storage_path,
        public_url,
        alt_text,
        display_order,
        is_cover
      )
    `)
    .eq('active', true)
    .eq('status', 'published')
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as PublicCatalogProduct[]).map(product => ({
    ...product,
    product_images: [...(product.product_images ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    ),
  }))
}

export async function getPublicProductBySlug(slug: string) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_images (
        id,
        product_id,
        storage_path,
        public_url,
        alt_text,
        display_order,
        is_cover
      )
    `)
    .eq('slug', slug)
    .eq('active', true)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const product = data as PublicCatalogProduct

  return {
    ...product,
    product_images: [...(product.product_images ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    ),
  }
}

export async function createProduct(input: ProductInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('Usuário não autenticado.')

  const { data, error } = await supabase
    .from('products')
    .insert({
      ...input,
      sku: input.sku || null,
      short_description: input.short_description || null,
      category_id: input.category_id || null,
      sale_price: input.sale_price ?? null,
      promotional_price: input.promotional_price ?? null,
      rental_daily_price: input.rental_daily_price ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) throw error

  return data as CatalogProductRow
}

export async function updateProduct(
  id: string,
  input: ProductInput,
) {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...input,
      sku: input.sku || null,
      short_description: input.short_description || null,
      category_id: input.category_id || null,
      sale_price: input.sale_price ?? null,
      promotional_price: input.promotional_price ?? null,
      rental_daily_price: input.rental_daily_price ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data as CatalogProductRow
}

export async function archiveProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .update({
      status: 'archived',
      active: false,
    })
    .eq('id', id)

  if (error) throw error
}
