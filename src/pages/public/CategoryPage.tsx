import { useEffect,useMemo,useState } from 'react'
import { Link,useLocation } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { ServicesPage } from './ServicesPage'
import {
  isEquipmentProduct,
  listPublicStoreItems,
  storeItemMatchesArea,
  type PublicCatalogArea,
} from '../../services/publicCatalog'
import type { PublicCatalogProduct } from '../../services/catalog'

const CATEGORIES: Record<string, {
 title:string
 subtitle:string
 icon:string
 color:string
 area:PublicCatalogArea
 productTitle:string
}> = {
  studio: { title:'Studio & Criação', subtitle:'Produção audiovisual, fotografia, edição, áudio e criação para transformar ideias em conteúdo.', icon:'🎬', color:'#ff6b35', area:'studio', productTitle:'Produtos e recursos para criação' },
  design: { title:'Design & Digital', subtitle:'Identidade visual, UI/UX, sites e presença digital pensados para comunicar e converter.', icon:'✦', color:'#4cc9f0', area:'design', productTitle:'Produtos digitais da área' },
  tech: { title:'Tech & Equipamentos', subtitle:'Tecnologia, equipamentos, web e suporte para colocar projetos em funcionamento com segurança.', icon:'⚡', color:'#06d6a0', area:'tech', productTitle:'Equipamentos e produtos de tecnologia' },
}

function money(value:number){
 return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100)
}

function cover(product:PublicCatalogProduct){
 return product.product_images.find(image=>image.is_cover)?.public_url
  ?? product.product_images[0]?.public_url
  ?? (typeof product.specifications?.cover_asset==='string'?product.specifications.cover_asset:null)
}

export function CategoryPage(){
  const location=useLocation()
  const key=location.pathname.split('/').filter(Boolean)[0]||''
  const cat=CATEGORIES[key]
  const [items,setItems]=useState<PublicCatalogProduct[]>([])
  const [productsLoading,setProductsLoading]=useState(true)

  useEffect(()=>{
   if(!cat){setProductsLoading(false);return}
   let active=true
   setProductsLoading(true)
   listPublicStoreItems()
    .then(rows=>{if(active)setItems(rows)})
    .catch(error=>{console.error(error);if(active)setItems([])})
    .finally(()=>{if(active)setProductsLoading(false)})
   return()=>{active=false}
  },[cat?.area])

  const areaItems=useMemo(
   ()=>cat?items.filter(item=>storeItemMatchesArea(item,cat.area)).slice(0,6):[],
   [items,cat],
  )

  if(!cat)return <ServicesPage />

  return <PublicLayout>
    <main>
      <section className="relative px-5 py-14 sm:py-20 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(circle at 50% 20%, ${cat.color}22, transparent 58%)`}}/>
        <div className="relative max-w-3xl mx-auto">
          <span aria-hidden="true" className="text-4xl block mb-4">{cat.icon}</span>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{color:cat.color}}>Área Play Moments</p>
          <h1 className="text-3xl sm:text-5xl font-bold mb-4" style={{color:'#f0f0f2'}}>{cat.title}</h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{color:'#9090a0'}}>{cat.subtitle}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
           <a href="#solucoes" className="min-h-11 inline-flex items-center px-5 py-3 rounded-xl font-semibold text-sm" style={{background:cat.color,color:'#071011'}}>Ver soluções</a>
           <a href="#catalogo-area" className="min-h-11 inline-flex items-center px-5 py-3 rounded-xl border border-white/10 bg-white/5 font-semibold text-sm">{cat.area==='tech'?'Ver equipamentos':'Ver produtos'}</a>
          </div>
        </div>
      </section>

      <section id="solucoes">
       <ServicesPage
        embedded
        area={cat.area}
        title={'Soluções em '+cat.title}
        subtitle="As ofertas são montadas a partir do catálogo público do banco. Se uma categoria ainda não tiver item publicado, você continua com caminhos úteis em vez de uma página vazia."
       />
      </section>

      <section id="catalogo-area" className="px-4 pb-16 sm:pb-20">
       <div className="mx-auto" style={{maxWidth:1100}}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
         <div>
          <p className="text-xs uppercase tracking-widest font-semibold" style={{color:cat.color}}>Catálogo da área</p>
          <h2 className="text-2xl sm:text-3xl font-bold mt-2">{cat.productTitle}</h2>
         </div>
         <Link to={cat.area==='tech'?'/produtos?tipo=equipamentos':'/produtos'} className="text-sm font-semibold text-gray-400">Abrir catálogo completo →</Link>
        </div>

        {productsLoading?<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0,1,2].map(i=><div key={i} className="pm-skeleton rounded-2xl h-52"/>)}</div>:
        areaItems.length===0?
         <div className="rounded-3xl border border-white/10 p-7 sm:p-9 bg-[#141416] flex flex-col md:flex-row md:items-center gap-5">
          <div className="w-14 h-14 shrink-0 rounded-2xl grid place-items-center bg-white/5 text-2xl">{cat.area==='tech'?'⌁':'◇'}</div>
          <div className="flex-1">
           <h3 className="font-bold text-lg">{cat.area==='tech'?'Nenhum equipamento publicado nesta área agora.':'Nenhum produto separado publicado nesta área agora.'}</h3>
           <p className="text-sm text-gray-400 mt-2">A área não fica vazia: as soluções acima continuam disponíveis e novos itens aparecem aqui automaticamente quando forem publicados no catálogo.</p>
          </div>
          <Link to="/produtos" className="min-h-11 inline-flex items-center justify-center px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold">Ver toda a loja</Link>
         </div>:
         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areaItems.map(product=>{
           const image=cover(product)
           const price=product.promotional_price??product.sale_price
           return <Link key={product.id} to={'/produtos/'+product.slug} className="group rounded-2xl overflow-hidden border border-white/10 bg-[#141416] hover:-translate-y-1 transition-transform">
            <div className="h-40 bg-[#19191d] overflow-hidden flex items-center justify-center">
             {image?<img src={image} alt={product.name} className={'w-full h-full '+(product.product_images.length?'object-cover':'object-contain p-5')}/>:<span className="text-3xl opacity-30">{isEquipmentProduct(product)?'⌁':'📦'}</span>}
            </div>
            <div className="p-4">
             <p className="text-xs font-semibold" style={{color:cat.color}}>{product.category?.name??(isEquipmentProduct(product)?'Equipamento':'Produto')}</p>
             <h3 className="font-bold mt-1">{product.name}</h3>
             {price!==null&&<p className="text-sm font-semibold mt-3">{money(price)}</p>}
             {product.rental_daily_price!==null&&<p className="text-xs text-gray-400 mt-1">Locação: {money(product.rental_daily_price)}/dia</p>}
            </div>
           </Link>
          })}
         </div>}
       </div>
      </section>
    </main>
  </PublicLayout>
}
