import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useCart } from '../../contexts/CartContext'
import { authLink } from '../../lib/navigation'
import { portalApi } from '../../api/portal'
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
    (typeof product.specifications?.cover_asset === 'string'
      ? product.specifications.cover_asset
      : null)
  )
}

export function ProductDetailPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { addItem } = useCart()

  const [product, setProduct] =
    useState<PublicCatalogProduct | null>(null)

  const [loading, setLoading] = useState(true)
  const [rental,setRental]=useState({start:'',end:'',quantity:1})
  const [renting,setRenting]=useState(false)

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

  const canBuy=(product?.commercial_mode==='sale'||product?.commercial_mode==='sale_and_rental')&&product?.sale_price!==null
  const canRent=(product?.commercial_mode==='rental'||product?.commercial_mode==='sale_and_rental')&&product?.rental_daily_price!==null
  const unavailable=Boolean(product?.inventory_tracked&&product.stock<=0)

  async function requestRental(){
    if(!product)return
    if(!user){navigate(authLink('/login','/produtos/'+product.slug));return}
    if(!rental.start||!rental.end){toast('Escolha as datas da locação.','error');return}
    try{setRenting(true);const rentalId=await portalApi.requestProductRental(product.id,rental.start,rental.end,rental.quantity);const orderId=await portalApi.checkoutProductRental(rentalId);await portalApi.createAsaasPayment(orderId,'PIX');toast('Reserva criada. O PIX foi gerado para confirmar a locação.','success');navigate('/app/pedidos/'+orderId+'?novo=1')}
    catch(e:any){toast(e.message||'Não foi possível solicitar a locação.','error')}finally{setRenting(false)}
  }

  function buy() {
    if (!product) return
    if (!user) { navigate(authLink('/cadastro', '/produtos/' + product.slug)); return }
    addItem({ id: product.id, name: product.name, slug: product.slug, price: product.promotional_price ?? product.sale_price ?? 0, image: getCover(product), stock: product.inventory_tracked ? product.stock : 1 })
    navigate('/carrinho')
  }

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-6 sm:py-12" style={{ maxWidth: 1100 }}>
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

            <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 mt-5 sm:mt-8">
              <div
                className="rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  minHeight: 'clamp(260px, 70vw, 420px)',
                  background: '#141416',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {getCover(product) ? (
                  <img
                    src={getCover(product) ?? ''}
                    alt={product.name}
                    className={'w-full h-full '+(product.product_images.length ? 'object-cover' : 'object-contain p-8')}
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
                      product.inventory_tracked
                        ? (product.stock > 0 ? 'success' : 'warning')
                        : 'success'
                    }
                  >
                    {product.inventory_tracked
                      ? (product.stock > 0 ? `${product.stock} em estoque` : 'Sem estoque')
                      : 'Disponível'}
                  </Badge>
                </div>

                {product.category?.name && <p className="text-xs uppercase tracking-wider mb-2" style={{color:'#E30613'}}>{product.category.name}</p>}

                <h1
                  className="text-2xl sm:text-4xl font-bold mb-3"
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
                  <div className="mt-6 grid grid-cols-1 sm:flex gap-3"><Button size="lg" fullWidth disabled={product.inventory_tracked && product.stock <= 0} onClick={buy}>{product.specifications?.catalog_kind === 'service' ? 'Contratar agora' : 'Comprar agora'}</Button><Button size="lg" fullWidth variant="secondary" disabled={product.inventory_tracked && product.stock <= 0} onClick={() => { addItem({ id: product.id, name: product.name, slug: product.slug, price: product.promotional_price ?? product.sale_price ?? 0, image: getCover(product), stock: product.inventory_tracked ? product.stock : 1 }); toast(product.specifications?.catalog_kind === 'service' ? 'Serviço adicionado ao carrinho.' : 'Produto adicionado ao carrinho.','success') }}>{product.specifications?.catalog_kind === 'service' ? 'Adicionar ao carrinho' : 'Adicionar ao carrinho'}</Button></div>
                )}

                {canRent&&<div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-sm font-semibold">Reservar para locação</p><p className="text-xs text-gray-500 mt-1">Escolha o período. O sistema verifica conflitos de reserva e calcula o valor com a diária cadastrada.</p><div className="grid grid-cols-2 gap-2 mt-3"><label className="text-[11px] text-gray-500">Retirada<input type="date" min={new Date().toISOString().slice(0,10)} value={rental.start} onChange={e=>setRental({...rental,start:e.target.value})} className="mt-1 w-full min-h-10 px-2 rounded-lg bg-black border border-white/10 text-white"/></label><label className="text-[11px] text-gray-500">Devolução<input type="date" min={rental.start||new Date().toISOString().slice(0,10)} value={rental.end} onChange={e=>setRental({...rental,end:e.target.value})} className="mt-1 w-full min-h-10 px-2 rounded-lg bg-black border border-white/10 text-white"/></label></div><label className="block text-[11px] text-gray-500 mt-2">Quantidade<input type="number" min="1" max={product.inventory_tracked?Math.max(1,product.stock):99} value={rental.quantity} onChange={e=>setRental({...rental,quantity:Math.max(1,Number(e.target.value)||1)})} className="mt-1 w-24 min-h-10 px-2 rounded-lg bg-black border border-white/10 text-white"/></label>{rental.start&&rental.end&&rental.end>=rental.start&&<p className="text-xs text-gray-400 mt-3">Valor estimado: <b className="text-white">{formatPrice((product.rental_daily_price||0)*((Math.floor((new Date(rental.end+'T12:00:00').getTime()-new Date(rental.start+'T12:00:00').getTime())/86400000)+1)*rental.quantity))}</b></p>}<Button size="lg" fullWidth className="mt-3" loading={renting} disabled={unavailable||!rental.start||!rental.end} onClick={()=>void requestRental()}>Reservar e gerar PIX</Button></div>}

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
