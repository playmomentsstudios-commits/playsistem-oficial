import { Link,useNavigate } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { portalApi } from '../../api/portal'
import { Button } from '../../components/ui/Button'
import { useState } from 'react'
import { authLink } from '../../lib/navigation'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function CartPage(){
 const {cart,removeItem,updateQuantity,clearCart}=useCart(); const {user}=useAuth(); const toast=useToast(); const navigate=useNavigate(); const [loading,setLoading]=useState(false)
 async function checkout(){
  if(!cart.items.length)return
  if(!user){navigate(authLink('/login','/carrinho'));return}
  try{
   setLoading(true)
   await portalApi.createCartOrder(cart.items.map(i=>({product_id:i.productId,quantity:i.quantity})))
   clearCart()
   toast('Pedido criado. Agora finalize o pagamento.','success')
   navigate('/app/pagamentos')
  }catch(e:any){toast(e.message||'Não foi possível finalizar a compra.','error')}finally{setLoading(false)}
 }
 return <PublicLayout><div className="mx-auto px-4 py-10" style={{maxWidth:1000}}><div className="flex justify-between items-end gap-4 mb-6"><div><p className="text-xs uppercase tracking-widest text-[#E30613]">Loja</p><h1 className="text-3xl font-bold mt-1">Carrinho</h1></div>{cart.items.length>0&&<button onClick={clearCart} className="text-sm text-gray-500">Limpar carrinho</button>}</div>
 {!cart.items.length?<div className="text-center py-16 rounded-2xl bg-[#141416] border border-white/10"><div className="text-5xl mb-4">🛒</div><h2 className="font-bold text-lg">Seu carrinho está vazio</h2><Link to="/produtos" className="inline-block mt-4 text-[#E30613]">Ver produtos →</Link></div>:
 <div className="grid lg:grid-cols-[1fr_320px] gap-6"><div className="space-y-3">{cart.items.map(i=><div key={i.productId} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex gap-4 items-center">{i.product.image?<img src={i.product.image} alt={i.product.name} className="w-20 h-20 object-cover rounded-xl"/>:<div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center">📦</div>}<div className="flex-1 min-w-0"><Link to={'/produtos/'+i.product.slug} className="font-semibold">{i.product.name}</Link><p className="text-sm text-gray-500">{money(i.price)}</p><div className="flex items-center gap-2 mt-3"><button onClick={()=>updateQuantity(i.productId,i.quantity-1)} className="w-9 h-9 rounded-lg bg-white/5">−</button><span className="w-8 text-center">{i.quantity}</span><button onClick={()=>updateQuantity(i.productId,i.quantity+1)} className="w-9 h-9 rounded-lg bg-white/5">+</button><button onClick={()=>removeItem(i.productId)} className="ml-3 text-xs text-red-400">Remover</button></div></div><b>{money(i.price*i.quantity)}</b></div>)}</div>
 <aside className="p-5 rounded-2xl bg-[#141416] border border-white/10 h-fit"><h2 className="font-bold">Resumo</h2><div className="flex justify-between mt-4 text-sm"><span className="text-gray-400">Subtotal</span><span>{money(cart.subtotal)}</span></div><div className="flex justify-between mt-3 pt-3 border-t border-white/10 text-lg font-bold"><span>Total</span><span>{money(cart.total)}</span></div><p className="text-xs text-gray-500 mt-3">O valor final é recalculado com os preços atuais do banco ao concluir.</p><Button fullWidth size="lg" className="mt-5" loading={loading} onClick={checkout}>Finalizar compra</Button></aside></div>}</div></PublicLayout>
}