import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { Badge } from '../../components/ui/Badge'
import {
  listPublicProducts,
  type PublicCatalogProduct,
} from '../../services/catalog'

function formatPrice(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function getCover(product: PublicCatalogProduct) {
  return (
    product.product_images.find(image => image.is_cover)?.public_url ??
    product.product_images[0]?.public_url ??
    (typeof product.specifications?.cover_asset === 'string'
      ? product.specifications.cover_asset
      : null)
  )
}

export function ProductsPage() {
  const [products, setProducts] = useState<PublicCatalogProduct[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')
        setProducts(await listPublicProducts())
      } catch (err) {
        console.error(err)
        setError('Não foi possível carregar os produtos.')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()

    return products.filter(product => {
      const matchesTerm = !term ||
        product.name.toLowerCase().includes(term) ||
        (product.short_description ?? '').toLowerCase().includes(term)
      const matchesCategory = category === 'todos' || product.category?.slug === category
      return matchesTerm && matchesCategory
    })
  }, [products, search, category])

  const categories = useMemo(() => {
    const map = new Map<string,string>()
    for (const product of products) {
      if (product.category?.slug && product.category?.name) {
        map.set(product.category.slug, product.category.name)
      }
    }
    return Array.from(map.entries()).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))
  }, [products])

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-12" style={{ maxWidth: 1100 }}>
        <div className="text-center mb-10">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: '#E30613' }}
          >
            Loja
          </p>

          <h1
            className="text-4xl font-bold mb-4"
            style={{ color: '#f0f0f2' }}
          >
            Produtos & Serviços
          </h1>

          <p className="text-sm" style={{ color: '#6b6b78' }}>
            Design, audiovisual, tecnologia, web e soluções criativas da Play Moments
          </p>
        </div>

        <div className="flex justify-center mb-4">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar produto..."
            className="w-full max-w-md px-5 py-3 rounded-full text-sm outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#f0f0f2',
            }}
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button type="button" onClick={()=>setCategory('todos')} className="px-3 py-1.5 rounded-full text-xs transition-colors" style={{background:category==='todos'?'#E30613':'rgba(255,255,255,0.05)',color:category==='todos'?'#fff':'#9090a0',border:'1px solid rgba(255,255,255,0.08)'}}>Todos</button>
          {categories.map(([slug,name])=><button key={slug} type="button" onClick={()=>setCategory(slug)} className="px-3 py-1.5 rounded-full text-xs transition-colors" style={{background:category===slug?'#E30613':'rgba(255,255,255,0.05)',color:category===slug?'#fff':'#9090a0',border:'1px solid rgba(255,255,255,0.08)'}}>{name}</button>)}
        </div>

        {loading && (
          <div
            className="text-center py-16"
            style={{ color: '#9090a0' }}
          >
            Carregando produtos...
          </div>
        )}

        {!loading && error && (
          <div
            className="text-center py-16"
            style={{ color: '#ff6b7a' }}
          >
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div
            className="text-center py-16"
            style={{ color: '#9090a0' }}
          >
            Nenhum produto publicado no momento.
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {filtered.map(product => {
              const cover = getCover(product)

              return (
                <Link
                  key={product.id}
                  to={`/produtos/${product.slug}`}
                  className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                  style={{
                    background: '#141416',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div
                    className="relative overflow-hidden flex items-center justify-center"
                    style={{
                      height: 200,
                      background: '#1a1a1f',
                    }}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt={product.name}
                        className={'w-full h-full transition-transform duration-500 group-hover:scale-105 '+(product.product_images.length ? 'object-cover' : 'object-contain p-5')}
                      />
                    ) : (
                      <span
                        className="text-4xl"
                        style={{ opacity: 0.35 }}
                      >
                        📦
                      </span>
                    )}

                    {product.featured && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="brand">Destaque</Badge>
                      </div>
                    )}

                    {product.promotional_price !== null && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="danger">Promoção</Badge>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <p
                      className="text-xs mb-1"
                      style={{ color: '#6b6b78' }}
                    >
                      {product.specifications?.catalog_kind === 'service'
                        ? 'Serviço'
                        : product.product_type === 'equipment'
                          ? 'Equipamento'
                          : 'Produto'}
                    </p>

                    <p
                      className="font-semibold text-sm mb-2"
                      style={{ color: '#f0f0f2' }}
                    >
                      {product.name}
                    </p>

                    {product.short_description && (
                      <p
                        className="text-xs mb-3 flex-1"
                        style={{ color: '#9090a0' }}
                      >
                        {product.short_description}
                      </p>
                    )}

                    {(product.commercial_mode === 'sale' ||
                      product.commercial_mode === 'sale_and_rental') &&
                      product.sale_price !== null && (
                        <div className="flex items-center gap-2">
                          <span
                            className="font-bold"
                            style={{
                              color: product.promotional_price
                                ? '#E30613'
                                : '#f0f0f2',
                            }}
                          >
                            {formatPrice(
                              product.promotional_price ??
                                product.sale_price,
                            )}
                          </span>

                          {product.promotional_price !== null && (
                            <span
                              className="text-xs line-through"
                              style={{ color: '#6b6b78' }}
                            >
                              {formatPrice(product.sale_price)}
                            </span>
                          )}
                        </div>
                      )}

                    {(product.commercial_mode === 'rental' ||
                      product.commercial_mode === 'sale_and_rental') &&
                      product.rental_daily_price !== null && (
                        <p
                          className="text-xs mt-2"
                          style={{ color: '#9090a0' }}
                        >
                          Locação: {formatPrice(product.rental_daily_price)}/dia
                        </p>
                      )}

                    <div
                      className="mt-3 pt-3 border-t"
                      style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{ color: '#E30613' }}
                      >
                        Ver detalhes →
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </PublicLayout>
  )
}
