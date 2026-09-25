import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useCart } from '../../contexts/CartContext'
import { portalApi } from '../../api/portal'
import { authLink } from '../../lib/navigation'
import {
  getPublicProductBySlug,
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
    null
  )
}

export function ProductDetailPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const [buying, setBuying] = useState(false)

  const [product, setProduct] =
    useState<PublicCatalogProduct | null>(null)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setProduct(await getPublicProductBySlug(slug))
      } catch (error) {
        console.error(error)
        setProduct(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [slug])

  async function buy() {
    if (!product) return
    if (!user) { navigate(authLink('/cadastro', '/produtos/' + product.slug)); return }
    try {
      setBuying(true)
      await portalApi.createProductOrder(product.id)
      toast('Pedido criado. Finalize o pagamento na sua área.','success')
      navigate('/app/pagamentos')
    } catch (error: any) { toast(error.message || 'Não foi possível criar o pedido.','error') }
    finally { setBuying(false) }
  }

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-12" style={{ maxWidth: 1100 }}>
        {loading && (
          <div
            className="text-center py-20"
            style={{ color: '#9090a0' }}
          >
            Carregando produto...
          </div>
        )}

        {!loading && !product && (
          <div className="text-center py-20">
            <h1
              className="text-2xl font-bold mb-4"
              style={{ color: '#f0f0f2' }}
            >
              Produto não encontrado
            </h1>

            <Link
              to="/produtos"
              style={{ color: '#E30613' }}
            >
              ← Voltar para produtos
            </Link>
          </div>
        )}

        {!loading && product && (
          <>
            <Link
              to="/produtos"
              className="text-sm"
              style={{ color: '#9090a0' }}
            >
              ← Voltar para produtos
            </Link>

            <div className="grid lg:grid-cols-2 gap-10 mt-8">
              <div
                className="rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  minHeight: 420,
                  background: '#141416',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {getCover(product) ? (
                  <img
                    src={getCover(product) ?? ''}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    style={{ maxHeight: 520 }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 80,
                      opacity: 0.25,
                    }}
                  >
                    📦
                  </span>
                )}
              </div>

              <div>
                <div className="flex gap-2 mb-4">
                  {product.featured && (
                    <Badge variant="brand">Destaque</Badge>
                  )}

                  <Badge
                    variant={
                      product.stock > 0 ? 'success' : 'warning'
                    }
                  >
                    {product.stock > 0
                      ? `${product.stock} em estoque`
                      : 'Sem estoque'}
                  </Badge>
                </div>

                <h1
                  className="text-4xl font-bold mb-3"
                  style={{ color: '#f0f0f2' }}
                >
                  {product.name}
                </h1>

                {product.short_description && (
                  <p
                    className="text-lg mb-6"
                    style={{ color: '#9090a0' }}
                  >
                    {product.short_description}
                  </p>
                )}

                {(product.commercial_mode === 'sale' ||
                  product.commercial_mode === 'sale_and_rental') &&
                  product.sale_price !== null && (
                    <div className="mb-5">
                      {product.promotional_price !== null ? (
                        <>
                          <p
                            className="text-sm line-through"
                            style={{ color: '#6b6b78' }}
                          >
                            {formatPrice(product.sale_price)}
                          </p>

                          <p
                            className="text-3xl font-bold"
                            style={{ color: '#E30613' }}
                          >
                            {formatPrice(
                              product.promotional_price,
                            )}
                          </p>
                        </>
                      ) : (
                        <p
                          className="text-3xl font-bold"
                          style={{ color: '#f0f0f2' }}
                        >
                          {formatPrice(product.sale_price)}
                        </p>
                      )}
                    </div>
                  )}

                {(product.commercial_mode === 'rental' ||
                  product.commercial_mode === 'sale_and_rental') &&
                  product.rental_daily_price !== null && (
                    <div
                      className="rounded-xl p-4 mb-6"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border:
                          '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <p
                        className="text-xs uppercase font-semibold mb-1"
                        style={{ color: '#9090a0' }}
                      >
                        Locação
                      </p>

                      <p
                        className="text-xl font-bold"
                        style={{ color: '#f0f0f2' }}
                      >
                        {formatPrice(product.rental_daily_price)}
                        <span
                          className="text-sm font-normal"
                          style={{ color: '#9090a0' }}
                        >
                          {' '}/ diária
                        </span>
                      </p>
                    </div>
                  )}

                <div
                  className="pt-6 border-t"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                  }}
                >
                  <h2
                    className="font-bold mb-3"
                    style={{ color: '#f0f0f2' }}
                  >
                    Sobre este produto
                  </h2>

                  <p
                    className="leading-7 whitespace-pre-line"
                    style={{ color: '#c0c0cc' }}
                  >
                    {product.description}
                  </p>
                </div>

                {(product.commercial_mode === 'sale' || product.commercial_mode === 'sale_and_rental') && product.sale_price !== null && (
                  <div className="mt-6 flex flex-wrap gap-3"><Button size="lg" loading={buying} disabled={product.stock <= 0} onClick={buy}>Comprar agora</Button><Button size="lg" variant="secondary" disabled={product.stock <= 0} onClick={() => { addItem({ id: product.id, name: product.name, slug: product.slug, price: product.promotional_price ?? product.sale_price ?? 0, image: getCover(product), stock: product.stock }); toast('Produto adicionado ao carrinho.','success') }}>Adicionar ao carrinho</Button></div>
                )}

                {product.sku && (
                  <p
                    className="text-xs mt-6"
                    style={{ color: '#6b6b78' }}
                  >
                    SKU: {product.sku}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  )
}
