import { Link,useNavigate } from 'react-router-dom'
import { PublicLayout } from '../../layouts/PublicLayout'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { portalApi } from '../../api/portal'
import { Button } from '../../components/ui/Button'
import { useState } from 'react'
import { Input } from '../../components/ui/Input'
import { supabase } from '../../lib/supabase'
import { authLink } from '../../lib/navigation'
const money=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100)
export function CartPage(){
 const {cart,removeItem,updateQuantity,clearCart}=useCart(); const {user}=useAuth(); const toast=useToast(); const navigate=useNavigate(); const [loading,setLoading]=useState(false); const [paymentMethod,setPaymentMethod]=useState<'PIX'|'CARD'>('PIX'); const [card,setCard]=useState({holderName:'',number:'',expiryMonth:'',expiryYear:'',ccv:'',installments:'1'}); const installmentCount=Math.max(1,Number(card.installments)||1); const installmentValue=Math.ceil(cart.total/installmentCount)
 async function checkout(){
  if(!cart.items.length)return
  if(!user){navigate(authLink('/login','/carrinho'));return}
  try{
   setLoading(true)
   const orderId=await portalApi.createCartOrder(cart.items.map(i=>({product_id:i.productId,quantity:i.quantity})))
   try{
    if(paymentMethod==='PIX'){
     await portalApi.createAsaasPayment(orderId,'PIX')
     clearCart()
     toast('Pedido criado. PIX Asaas gerado com sucesso.','success')
     navigate('/app/pagamentos')
    }else if(paymentMethod==='CARD'){
     const {data,error}=await supabase.functions.invoke('asaas-card-payment',{body:{order_id:orderId,installment_count:Number(card.installments),credit_card:{holderName:card.holderName,number:card.number,expiryMonth:card.expiryMonth,expiryYear:card.expiryYear,ccv:card.ccv}}})
     if(error){let message='Não foi possível processar o cartão.';try{const payload=await (error as any)?.context?.json?.();if(payload?.error)message=payload.error}catch{};throw new Error(message)}
     if(!data?.ok)throw new Error(data?.error||'Não foi possível processar o cartão.')
     clearCart();toast('Pagamento enviado ao Asaas com sucesso.','success');navigate('/app/pagamentos')
    }
   }catch(paymentError:any){
    toast('Pedido criado, mas o pagamento falhou: '+(paymentError.message||'erro desconhecido'),'error')
    navigate('/app/pagamentos')
    return
   }
  }catch(e:any){toast(e.message||'Não foi possível finalizar a compra.','error')}finally{setLoading(false)}
 }
 return <PublicLayout><div className="mx-auto px-4 py-6 sm:py-10" style={{maxWidth:1000}}><div className="flex justify-between items-end gap-4 mb-6"><div><p className="text-xs uppercase tracking-widest text-[#E30613]">Loja</p><h1 className="text-3xl font-bold mt-1">Carrinho</h1></div>{cart.items.length>0&&<button onClick={clearCart} className="text-sm text-gray-500">Limpar carrinho</button>}</div>
 {!cart.items.length?<div className="text-center py-16 rounded-2xl bg-[#141416] border border-white/10"><div className="text-5xl mb-4">🛒</div><h2 className="font-bold text-lg">Seu carrinho está vazio</h2><Link to="/produtos" className="inline-block mt-4 text-[#E30613]">Ver produtos →</Link></div>:
 <div className="grid lg:grid-cols-[1fr_360px] gap-6"><div className="space-y-3">{cart.items.map(i=><div key={i.productId} className="p-3 sm:p-4 rounded-2xl bg-[#141416] border border-white/10 grid grid-cols-[64px_1fr] sm:flex gap-3 sm:gap-4 items-center">{i.product.image?<img src={i.product.image} alt={i.product.name} className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl"/>:<div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white/5 flex items-center justify-center">📦</div>}<div className="flex-1 min-w-0"><Link to={'/produtos/'+i.product.slug} className="font-semibold">{i.product.name}</Link><p className="text-sm text-gray-500">{money(i.price)}</p><div className="flex items-center gap-2 mt-3"><button onClick={()=>updateQuantity(i.productId,i.quantity-1)} className="w-10 h-10 rounded-xl bg-white/5">−</button><span className="w-8 text-center">{i.quantity}</span><button onClick={()=>updateQuantity(i.productId,i.quantity+1)} className="w-9 h-9 rounded-lg bg-white/5">+</button><button onClick={()=>removeItem(i.productId)} className="ml-auto sm:ml-3 min-h-10 px-2 text-xs text-red-400">Remover</button></div></div><b className="col-span-2 sm:col-span-1 text-right sm:text-left">{money(i.price*i.quantity)}</b></div>)}</div>
 <aside className="p-5 rounded-2xl bg-[#141416] border border-white/10 h-fit"><h2 className="font-bold">Resumo</h2>{user&&<div className="mt-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15"><p className="text-xs text-emerald-400 font-semibold">✓ Compra vinculada à sua conta</p><p className="text-xs text-gray-500 mt-1">{user.name} {user.lastName} · {user.email}</p><p className="text-[11px] text-gray-600 mt-1">Usaremos os dados e o endereço do seu cadastro no processamento.</p></div>}<div className="flex justify-between mt-4 text-sm"><span className="text-gray-400">Subtotal</span><span>{money(cart.subtotal)}</span></div><div className="flex justify-between mt-3 pt-3 border-t border-white/10 text-lg font-bold"><span>Total</span><span>{money(cart.total)}</span></div><p className="text-xs text-gray-500 mt-3">O valor final é recalculado com os preços atuais do banco ao concluir.</p><div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5"><div className="flex justify-between text-xs"><span className="text-gray-500">Itens</span><span>{cart.items.reduce((sum,item)=>sum+item.quantity,0)}</span></div><div className="flex justify-between text-xs mt-2"><span className="text-gray-500">Pagamento</span><span>{paymentMethod==='PIX'?'PIX':installmentCount+'x no cartão'}</span></div>{paymentMethod==='CARD'&&<div className="flex justify-between text-xs mt-2"><span className="text-gray-500">Valor da parcela</span><span>{money(installmentValue)}</span></div>}</div><div className="mt-5 space-y-2"><p className="text-sm font-semibold">Forma de pagamento</p><label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer"><input type="radio" name="payment" checked={paymentMethod==='PIX'} onChange={()=>setPaymentMethod('PIX')}/><span className="flex-1"><span className="flex items-center justify-between gap-2"><b>PIX</b><em className="not-italic text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Mais rápido</em></span><small className="block text-gray-500">QR Code Asaas · confirmação automática</small></span></label><label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer"><input type="radio" name="payment" checked={paymentMethod==='CARD'} onChange={()=>setPaymentMethod('CARD')}/><span className="flex-1"><span className="flex items-center justify-between gap-2"><b>Cartão de crédito</b><em className="not-italic text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">até 12x</em></span><small className="block text-gray-500">Pagamento seguro sem sair do Play Moments</small></span></label>{paymentMethod==='CARD'&&<div className="p-3 rounded-xl bg-black/20 border border-white/10 space-y-3"><p className="text-xs text-gray-400">Nome, e-mail, CPF/CNPJ, telefone e endereço serão usados do seu cadastro.</p><Input label="Nome impresso no cartão" value={card.holderName} onChange={e=>setCard({...card,holderName:e.target.value})}/><Input label="Número do cartão" inputMode="numeric" value={card.number} onChange={e=>setCard({...card,number:e.target.value})}/><div className="grid grid-cols-3 gap-2"><Input label="Mês" inputMode="numeric" value={card.expiryMonth} onChange={e=>setCard({...card,expiryMonth:e.target.value})}/><Input label="Ano" inputMode="numeric" value={card.expiryYear} onChange={e=>setCard({...card,expiryYear:e.target.value})}/><Input label="CVV" inputMode="numeric" value={card.ccv} onChange={e=>setCard({...card,ccv:e.target.value})}/></div><label className="block text-xs text-gray-400">Parcelas<select className="mt-1 w-full rounded-xl bg-[#202024] border border-white/10 p-3 text-white" value={card.installments} onChange={e=>setCard({...card,installments:e.target.value})}>{Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x de {money(Math.ceil(cart.total/n))}{n===1?' à vista':''}</option>)}</select></label><p className="text-[11px] text-gray-500">Os dados do cartão são enviados diretamente para processamento e não são salvos no Play Moments.</p><Link to="/app/pagamentos" className="inline-flex text-[11px] text-[#E30613]">Gerenciar formas de pagamento →</Link></div>}</div>{user&&<div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500"><span>🔒</span><span>Pagamento processado em ambiente seguro. Seus dados de cartão não ficam armazenados na Play Moments.</span></div>}{!user&&<div className="mt-4 p-3 rounded-xl bg-white/[0.035] border border-white/10">
  <p className="text-xs font-semibold">Finalize com sua conta</p>
  <p className="text-[11px] text-gray-500 mt-1">Entre se já tiver cadastro ou crie sua conta sem perder os itens do carrinho.</p>
  <div className="grid grid-cols-2 gap-2 mt-3">
    <Link to={authLink('/login','/carrinho')} className="min-h-10 px-3 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold flex items-center justify-center">Entrar</Link>
    <Link to={authLink('/cadastro','/carrinho')} className="min-h-10 px-3 rounded-xl bg-[#E30613] text-white text-xs font-semibold flex items-center justify-center">Criar conta</Link>
  </div>
</div>}<Button fullWidth size="lg" className="mt-5" loading={loading} onClick={checkout}>{user?'Finalizar compra':'Continuar para finalizar'}</Button></aside></div>}</div></PublicLayout>
}