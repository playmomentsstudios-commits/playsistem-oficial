import { Link,useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { afterAuthPath,safeReturnPath } from '../../lib/navigation'
import logoUrl from '../../assets/logo-play-moments.png'
export function EmailConfirmedPage(){
 const {user,isLoading}=useAuth(); const [params]=useSearchParams(); const next=safeReturnPath(params.get('next'))
 const hash=new URLSearchParams(window.location.hash.replace(/^#/,'')); const error=params.get('error_description')||hash.get('error_description')
 const href=user?afterAuthPath(next,user.role):('/login'+(next?'?'+new URLSearchParams({next}).toString():''))
 return <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b]"><div className="max-w-md w-full text-center p-8 rounded-2xl bg-[#141416] border border-white/10"><Link to="/"><img src={logoUrl} alt="Play Moments" className="mx-auto mb-6" style={{height:32}}/></Link>{isLoading?<p>Confirmando...</p>:error?<><h1 className="text-2xl font-bold">Não foi possível confirmar este link</h1><p className="text-gray-400 mt-3">{error}</p></>:<><div className="text-4xl mb-4">✅</div><h1 className="text-2xl font-bold">E-mail confirmado com sucesso</h1><p className="text-gray-400 mt-3">Sua conta Play Moments está pronta.</p></>}<Link to={href} className="inline-block mt-6 px-5 py-3 rounded-xl bg-[#E30613] text-white font-semibold">{user?'Acessar minha conta':'Ir para o login'}</Link></div></div>
}