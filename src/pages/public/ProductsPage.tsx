import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { Badge } from '../../components/ui/Badge'
import {
  isEquipmentProduct,
  isRentalProduct,
  listPublicStoreItems,
} from '../../services/publicCatalog'
import type { PublicCatalogProduct } from '../../services/catalog'

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

const CATEGORY_COLORS:Record<string,string>={
  'audio-musica':'#7C3AED',
  'branding-identidade':'#F43F5E',
  'comercial-institucional':'#F59E0B',
  'design-grafico':'#EF4444',
  'dj-eventos':'#EC4899',
  'motion-graphics':'#8B5CF6',
  'social-media-conteudo':'#3B82F6',
  'video-audiovisual':'#14B8A6',
  'web-sistemas':'#22C55E',
  'studio':'#F97316',
  'equipamentos':'#06B6D4',
  'tecnologia':'#6366F1',
}

function categoryColor(slug?:string|null){
  return (slug&&CATEGORY_COLORS[slug])||'#E30613'
}

type CatalogView='todos'|'produtos'|'equipamentos'|'locacao'

const VIEWS:Array<{key:CatalogView;label:string;description:string}>= [
  {key:'todos',label:'Todos',description:'Tudo que está publicado para compra ou locação.'},
  {key:'produtos',label:'Produtos',description:'Itens físicos e digitais disponíveis no catálogo.'},
  {key:'equipamentos',label:'Equipamentos',description:'Equipamentos disponíveis para compra ou uso em projetos.'},
  {key:'locacao',label:'Locação',description:'Itens com diária de locação configurada.'},
]

export function ProductsPage() {
  const location=useLocation()
  const navigate=useNavigate()
  const [params,setParams]=useSearchParams()
  const initial=(location.pathname==='/equipamentos'?'equipamentos':(params.get('tipo')||'todos')) as CatalogView
  const [products, setProducts] = useState<PublicCatalogProduct[]>([])
  const [search, setSearch] = useState('')
  const [view,setView]=useState<CatalogView>(VIEWS.some(x=>x.key===initial)?initial:'todos')
  const [category, setCategory] = useState('todos')
  const [maxPrice,setMaxPrice]=useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{
    const desiredView=(location.pathname==='/equipamentos'?'equipamentos':(params.get('tipo')||'todos')) as CatalogView
    if(VIEWS.some(item=>item.key===desiredView))setView(desiredView)
  },[location.pathname,params.toString()])

  useEffect(() => {
    let active=true
    async function load() {
      try {
        setLoading(true)
        setError('')
        const rows=await listPublicStoreItems()
        if(active)setProducts(rows)
      } catch (err) {
        console.error(err)
        if(active)setError('Não foi possível carregar o catálogo agora.')
      } finally {
        if(active)setLoading(false)
      }
    }
    void load()
    return()=>{active=false}
  }, [])

  function chooseView(next:CatalogView){
    setView(next)
    setCategory('todos')
    if(location.pathname==='/equipamentos'&&next!=='equipamentos'){
      navigate(next==='todos'?'/produtos':('/produtos?tipo='+next))
      return
    }
    if(location.pathname!=='/equipamentos'&&next==='equipamentos'){
      navigate('/equipamentos')
      return
    }
    const copy=new URLSearchParams(params)
    if(next==='todos')copy.delete('tipo')
    else copy.set('tipo',next)
    setParams(copy,{replace:true})
  }

  const scoped=useMemo(()=>{
    if(view==='equipamentos')return products.filter(isEquipmentProduct)
    if(view==='locacao')return products.filter(isRentalProduct)
    if(view==='produtos')return products.filter(product=>!isEquipmentProduct(product))
    return products
  },[products,view])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return scoped.filter(product => {
      const matchesTerm = !term ||
        product.name.toLowerCase().includes(term) ||
        (product.short_description ?? '').toLowerCase().includes(term)
      const matchesCategory = category === 'todos' || product.category?.slug === category
      const effectivePrice = product.promotional_price ?? product.sale_price ?? product.rental_daily_price ?? 0
      const matchesPrice = maxPrice === 'todos' || effectivePrice <= Number(maxPrice)
      return matchesTerm && matchesCategory && matchesPrice
    })
  }, [scoped, search, category, maxPrice])

  const categories = useMemo(() => {
    const map = new Map<string,string>()
    for (const product of scoped) {
      if (product.category?.slug && product.category?.name) {
        map.set(product.category.slug, product.category.name)
      }
    }
    return Array.from(map.entries()).sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))
  }, [scoped])

  const equipmentCount=products.filter(isEquipmentProduct).length
  const rentalCount=products.filter(isRentalProduct).length
  const productCount=products.filter(product=>!isEquipmentProduct(product)).length
  const activeView=VIEWS.find(item=>item.key===view)??VIEWS[0]
  const dedicatedEquipment=location.pathname==='/equipamentos'

  return (
    <PublicLayout>
      <div className="mx-auto px-4 py-10 sm:py-14" style={{ maxWidth: 1160 }}>
        <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end mb-9">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#E30613' }}>{dedicatedEquipment?'Tech & Equipamentos':'Loja Play Moments'}</p>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: '#f0f0f2' }}>{dedicatedEquipment?'Equipamentos':'Produtos & Equipamentos'}</h1>
            <p className="text-sm sm:text-base" style={{ color: '#8b8b98' }}>
              {dedicatedEquipment
                ? 'Equipamentos publicados para compra ou locação. Quando não houver item disponível, a página mantém alternativas úteis sem ficar vazia.'
                : 'Compra e locação ficam separadas dos serviços criativos. O que for serviço está em uma vitrine própria.'}
            </p>
          </div>
          <Link to="/servicos" className="min-h-11 inline-flex items-center justify-center px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold">
            Procurando serviços? →
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {VIEWS.map(item=>{
            const count=item.key==='todos'?products.length:item.key==='equipamentos'?equipmentCount:item.key==='locacao'?rentalCount:productCount
            const selected=view===item.key
            return <button key={item.key} type="button" onClick={()=>chooseView(item.key)} className="text-left rounded-2xl p-4 sm:p-5 transition-all" style={{background:selected?'linear-gradient(135deg,rgba(227,6,19,.16),rgba(255,255,255,.04))':'#141416',border:'1px solid '+(selected?'rgba(227,6,19,.55)':'rgba(255,255,255,.08)')}}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold text-sm sm:text-base">{item.label}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">{count}</span>
              </div>
              <p className="hidden sm:block text-xs text-gray-500 mt-2 leading-relaxed">{item.description}</p>
            </button>
          })}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111113] p-4 sm:p-5 mb-7">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={view==='equipamentos'?'Buscar equipamento...':'Buscar no catálogo...'}
              className="w-full lg:max-w-sm px-4 py-3 rounded-xl text-sm outline-none"
              style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.09)',color:'#f0f0f2'}}
            />
            <div className="flex gap-2 overflow-x-auto lg:flex-1">
              <button type="button" onClick={()=>setCategory('todos')} className="shrink-0 px-3 py-2 rounded-full text-xs" style={{background:category==='todos'?'#E30613':'rgba(255,255,255,0.04)',color:category==='todos'?'#fff':'#9090a0',border:'1px solid rgba(255,255,255,0.08)'}}>Todas as categorias</button>
              {categories.map(([slug,name])=>{
                const color=categoryColor(slug)
                return <button key={slug} type="button" onClick={()=>setCategory(slug)} className="shrink-0 px-3 py-2 rounded-full text-xs" style={{background:category===slug?color:'rgba(255,255,255,0.04)',color:category===slug?'#fff':color,border:'1px solid '+(category===slug?color:'rgba(255,255,255,0.08)')}}>{name}</button>
              })}
            </div>
            <select value={maxPrice} onChange={event=>setMaxPrice(event.target.value)} className="px-4 py-3 rounded-xl text-xs outline-none">
              <option value="todos">Todos os valores</option>
              <option value="50000">Até R$ 500</option>
              <option value="100000">Até R$ 1.000</option>
              <option value="200000">Até R$ 2.000</option>
              <option value="500000">Até R$ 5.000</option>
              <option value="1000000">Até R$ 10.000</option>
            </select>
          </div>
        </div>

        {loading && <ProductSkeleton/>}

        {!loading && error && (
          <CatalogEmpty
            title="Catálogo temporariamente indisponível"
            text={error+' Você ainda pode acessar os serviços ou falar com a Play Moments.'}
          />
        )}

        {!loading && !error && filtered.length === 0 && (
          <CatalogEmpty
            title={scoped.length===0?`Ainda não há ${activeView.label.toLowerCase()} publicados.`:'Nenhum item corresponde aos filtros.'}
            text={scoped.length===0?'Esta seção já está preparada e aparecerá automaticamente quando um item for publicado no catálogo.':'Limpe a busca ou escolha outra categoria para continuar.'}
            onReset={scoped.length>0?()=>{setSearch('');setCategory('todos');setMaxPrice('todos')}:undefined}
          />
        )}

        {!loading && !error && filtered.length>0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">{activeView.label}</p>
              <p className="text-xs text-gray-500">{filtered.length} {filtered.length===1?'item':'itens'}</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {filtered.map(product => {
                const cover = getCover(product)
                const color = categoryColor(product.category?.slug)
                const equipment=isEquipmentProduct(product)

                return (
                  <Link key={product.id} to={`/produtos/${product.slug}`} className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1" style={{background:'#141416',border:'1px solid rgba(255,255,255,0.07)'}}>
                    <div className="relative overflow-hidden flex items-center justify-center" style={{height:200,background:'#1a1a1f'}}>
                      {cover ? <img src={cover} alt={product.name} className={'w-full h-full transition-transform duration-500 group-hover:scale-105 '+(product.product_images.length?'object-cover':'object-contain p-4 sm:p-5')} /> : <span className="text-4xl" style={{opacity:.35}}>{equipment?'⌁':'📦'}</span>}
                      <div className="absolute top-3 left-3 flex gap-2">
                        {product.featured&&<Badge variant="brand">Destaque</Badge>}
                        {equipment&&<span className="text-[10px] font-bold px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/20">Equipamento</span>}
                      </div>
                      {product.promotional_price!==null&&<div className="absolute top-3 right-3"><Badge variant="danger">Promoção</Badge></div>}
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <p className="text-[10px] sm:text-xs mb-1 font-semibold" style={{color}}>{product.category?.name??(equipment?'Equipamento':'Produto')}</p>
                      <p className="font-semibold text-sm mb-2" style={{color:'#f0f0f2'}}>{product.name}</p>
                      {product.short_description&&<p className="text-xs mb-3 flex-1 line-clamp-3" style={{color:'#9090a0'}}>{product.short_description}</p>}

                      {(product.commercial_mode==='sale'||product.commercial_mode==='sale_and_rental')&&product.sale_price!==null&&
                        <div className="flex items-center gap-2"><span className="font-bold" style={{color:product.promotional_price?'#E30613':'#f0f0f2'}}>{formatPrice(product.promotional_price??product.sale_price)}</span>{product.promotional_price!==null&&<span className="text-xs line-through" style={{color:'#6b6b78'}}>{formatPrice(product.sale_price)}</span>}</div>}

                      {(product.commercial_mode==='rental'||product.commercial_mode==='sale_and_rental')&&product.rental_daily_price!==null&&
                        <p className="text-xs mt-2" style={{color:'#8dcfe0'}}>Locação: {formatPrice(product.rental_daily_price)}/dia</p>}

                      <div className="mt-3 pt-3 border-t" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                        <span className="text-xs font-semibold" style={{color}}>Ver detalhes →</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </PublicLayout>
  )
}

function ProductSkeleton(){
 return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5" aria-label="Carregando catálogo">
  {[0,1,2,3].map(i=><div key={i} className="rounded-2xl overflow-hidden border border-white/10 bg-[#141416]"><div className="pm-skeleton h-48"/><div className="p-4"><div className="pm-skeleton h-3 w-20 rounded mb-3"/><div className="pm-skeleton h-5 w-4/5 rounded mb-3"/><div className="pm-skeleton h-12 w-full rounded"/></div></div>)}
 </div>
}

function CatalogEmpty({title,text,onReset}:{title:string;text:string;onReset?:()=>void}){
 return <div className="rounded-3xl border border-white/10 bg-[#141416] px-6 py-12 text-center">
  <div className="mx-auto w-14 h-14 rounded-2xl grid place-items-center bg-white/5 text-2xl">⌁</div>
  <h2 className="text-xl font-bold mt-4">{title}</h2>
  <p className="text-sm text-gray-400 max-w-xl mx-auto mt-2">{text}</p>
  <div className="flex flex-wrap justify-center gap-3 mt-6">
   {onReset&&<button type="button" onClick={onReset} className="min-h-11 px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold">Limpar filtros</button>}
   <Link to="/servicos" className="min-h-11 inline-flex items-center px-5 py-3 rounded-xl bg-[#E30613] text-sm font-semibold">Explorar serviços</Link>
   <Link to="/tech" className="min-h-11 inline-flex items-center px-5 py-3 rounded-xl border border-white/10 text-sm font-semibold">Tech & Equipamentos</Link>
  </div>
 </div>
}
