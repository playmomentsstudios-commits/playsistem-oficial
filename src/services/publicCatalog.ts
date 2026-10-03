import { portalApi } from '../api/portal'
import {
  listPublicProducts,
  type PublicCatalogProduct,
} from './catalog'

export type PublicCatalogArea = 'design' | 'studio' | 'tech'

export type PublicServiceOffer = {
  id: string
  name: string
  slug: string
  short_description: string | null
  description: string
  category: string | null
  category_slug: string | null
  price_type: 'fixed' | 'starting_at' | 'quote'
  price: number | null
  starting_price: number | null
  active: boolean
  featured: boolean
  estimated_deadline: string | null
  deliverables: string[]
  revision_count: number | null
  delivery_format: string | null
  customer_requirements: string[]
  included_items: string[]
  excluded_items: string[]
  source: 'service' | 'catalog'
  catalog_product: PublicCatalogProduct | null
}

const AREA_CATEGORY_SLUGS: Record<PublicCatalogArea, string[]> = {
  design: [
    'design-grafico',
    'branding-identidade',
    'social-media-conteudo',
    'comercial-institucional',
  ],
  studio: [
    'video-audiovisual',
    'motion-graphics',
    'audio-musica',
    'dj-eventos',
    'studio',
  ],
  tech: [
    'web-sistemas',
    'equipamentos',
    'tecnologia',
    'tech-equipamentos',
  ],
}

const AREA_CATEGORY_NAMES: Record<PublicCatalogArea, string[]> = {
  design: ['design', 'digital', 'branding', 'identidade', 'social media', 'comercial', 'institucional'],
  studio: ['studio', 'criação', 'criacao', 'vídeo', 'video', 'audiovisual', 'motion', 'áudio', 'audio', 'música', 'musica', 'dj', 'eventos'],
  tech: ['tech', 'tecnologia', 'equipamentos', 'web', 'sistemas'],
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isCatalogService(product: PublicCatalogProduct) {
  return normalize(String(product.specifications?.catalog_kind ?? '')) === 'service'
}

export function isEquipmentProduct(product: PublicCatalogProduct) {
  const slug = normalize(product.category?.slug)
  return (
    product.product_type === 'equipment' ||
    slug === 'equipamentos' ||
    slug === 'tecnologia' ||
    slug === 'tech-equipamentos'
  )
}

export function isRentalProduct(product: PublicCatalogProduct) {
  return (
    product.commercial_mode === 'rental' ||
    product.commercial_mode === 'sale_and_rental'
  )
}

function catalogOffer(product: PublicCatalogProduct): PublicServiceOffer {
  const specs = product.specifications ?? {}
  const revisionText = String(specs.revisions ?? '')
  const revisionMatch = revisionText.match(/\d+/)
  const price = product.promotional_price ?? product.sale_price

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    short_description: product.short_description,
    description: product.description,
    category: product.category?.name ?? 'Serviço',
    category_slug: product.category?.slug ?? null,
    price_type: price !== null ? 'fixed' : 'quote',
    price,
    starting_price: null,
    active: product.active,
    featured: product.featured,
    estimated_deadline:
      typeof specs.estimated_deadline === 'string' ? specs.estimated_deadline : null,
    deliverables: [],
    revision_count: revisionMatch ? Number(revisionMatch[0]) : null,
    delivery_format:
      typeof specs.delivery_format === 'string' ? specs.delivery_format : null,
    customer_requirements: [],
    included_items: [],
    excluded_items: [],
    source: 'catalog',
    catalog_product: product,
  }
}

function dedicatedOffer(row: any): PublicServiceOffer {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    short_description: row.short_description ?? null,
    description: String(row.description ?? ''),
    category: row.category ?? null,
    category_slug: null,
    price_type:
      row.price_type === 'fixed' || row.price_type === 'starting_at'
        ? row.price_type
        : 'quote',
    price: typeof row.price === 'number' ? row.price : null,
    starting_price:
      typeof row.starting_price === 'number' ? row.starting_price : null,
    active: row.active !== false,
    featured: row.featured === true,
    estimated_deadline: row.estimated_deadline ?? null,
    deliverables: Array.isArray(row.deliverables) ? row.deliverables : [],
    revision_count:
      typeof row.revision_count === 'number' ? row.revision_count : null,
    delivery_format: row.delivery_format ?? null,
    customer_requirements: Array.isArray(row.customer_requirements)
      ? row.customer_requirements
      : [],
    included_items: Array.isArray(row.included_items) ? row.included_items : [],
    excluded_items: Array.isArray(row.excluded_items) ? row.excluded_items : [],
    source: 'service',
    catalog_product: null,
  }
}

export async function listPublicServiceOffers() {
  const [servicesResult, productsResult] = await Promise.allSettled([
    portalApi.services(),
    listPublicProducts(),
  ])

  const offers = new Map<string, PublicServiceOffer>()

  if (productsResult.status === 'fulfilled') {
    for (const product of productsResult.value) {
      if (isCatalogService(product)) {
        const offer = catalogOffer(product)
        offers.set(offer.slug, offer)
      }
    }
  }

  // The dedicated services table wins when the same slug exists there,
  // because it has richer commercial fields and the request_service flow.
  if (servicesResult.status === 'fulfilled') {
    for (const row of servicesResult.value) {
      const offer = dedicatedOffer(row)
      offers.set(offer.slug, offer)
    }
  }

  if (
    servicesResult.status === 'rejected' &&
    productsResult.status === 'rejected'
  ) {
    throw servicesResult.reason ?? productsResult.reason
  }

  return [...offers.values()].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

export async function getPublicServiceOfferBySlug(slug: string) {
  const offers = await listPublicServiceOffers()
  return offers.find(offer => offer.slug === slug) ?? null
}

export async function listPublicStoreItems() {
  const rows = await listPublicProducts()
  return rows.filter(product => !isCatalogService(product))
}

export function serviceOfferMatchesArea(
  offer: PublicServiceOffer,
  area: PublicCatalogArea,
) {
  if (
    offer.category_slug &&
    AREA_CATEGORY_SLUGS[area].includes(normalize(offer.category_slug))
  ) {
    return true
  }

  const category = normalize(offer.category)
  return AREA_CATEGORY_NAMES[area].some(token => category.includes(normalize(token)))
}

export function storeItemMatchesArea(
  product: PublicCatalogProduct,
  area: PublicCatalogArea,
) {
  const slug = normalize(product.category?.slug)
  if (AREA_CATEGORY_SLUGS[area].includes(slug)) return true
  if (area === 'tech' && isEquipmentProduct(product)) return true

  const category = normalize(product.category?.name)
  return AREA_CATEGORY_NAMES[area].some(token => category.includes(normalize(token)))
}
