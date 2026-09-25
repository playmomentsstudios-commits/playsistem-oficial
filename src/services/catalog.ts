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
  inventory_tracked: boolean
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
  category?: Pick<ProductCategoryRow,'id'|'name'|'slug'> | null
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
      ),
      category:product_categories (
        id,
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as PublicCatalogProduct[]).map(product => ({
    ...product,
    product_images: [...(product.product_images ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    ),
  }))
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
      ),
      category:product_categories (
        id,
        name,
        slug
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
      ),
      category:product_categories (
        id,
        name,
        slug
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

export async function createCategory(input:{name:string;slug:string;description?:string|null;active:boolean;display_order:number}) {
  const { data,error }=await supabase.from('product_categories').insert(input).select().single()
  if(error) throw error
  return data as ProductCategoryRow
}
export async function updateCategory(id:string,input:Partial<{name:string;slug:string;description:string|null;active:boolean;display_order:number}>) {
  const { data,error }=await supabase.from('product_categories').update(input).eq('id',id).select().single()
  if(error) throw error
  return data as ProductCategoryRow
}
export async function archiveCategory(id:string) {
  const { error }=await supabase.from('product_categories').update({active:false}).eq('id',id)
  if(error) throw error
}


export async function uploadProductImage(
  productId: string,
  file: File,
  displayOrder: number,
  isCover = false,
) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ['jpg','jpeg','png','webp','avif'].includes(ext) ? ext : 'jpg'
  const storagePath = productId + '/' + crypto.randomUUID() + '.' + safeExt

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

  if (uploadError) throw uploadError

  const { data: publicData } = supabase.storage
    .from('product-images')
    .getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: storagePath,
      public_url: publicData.publicUrl,
      alt_text: file.name,
      display_order: displayOrder,
      is_cover: false,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from('product-images').remove([storagePath])
    throw error
  }

  if (isCover) {
    await setProductCover(productId, data.id)
    return { ...(data as ProductImageRow), is_cover: true }
  }

  return data as ProductImageRow
}

export async function deleteProductImage(image: ProductImageRow) {
  const { error: rowError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', image.id)

  if (rowError) throw rowError

  const { error: storageError } = await supabase.storage
    .from('product-images')
    .remove([image.storage_path])

  if (storageError) throw storageError
}

export async function setProductCover(productId: string, imageId: string) {
  const { error } = await supabase.rpc('set_product_cover', {
    p_product_id: productId,
    p_image_id: imageId,
  })

  if (error) throw error
}

export async function reorderProductImages(images: ProductImageRow[]) {
  for (let index = 0; index < images.length; index += 1) {
    const { error } = await supabase
      .from('product_images')
      .update({ display_order: index })
      .eq('id', images[index].id)

    if (error) throw error
  }
}
