import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLocation } from 'react-router-dom'
import { useSeo } from '../lib/seo'

const pages:Record<string,{title:string;description:string;noindex?:boolean}>={
 '/':{title:'Sagamente — Tecnologia, criação e conhecimento',description:'Serviços criativos, tecnologia, equipamentos e conhecimento em uma plataforma integrada.'},
 '/produtos':{title:'Produtos e Equipamentos',description:'Encontre tecnologia e equipamentos selecionados pela Sagamente para seus projetos.'},
 '/servicos':{title:'Serviços Criativos e Digitais',description:'Design, audiovisual, tecnologia e soluções digitais com acompanhamento centralizado pela Sagamente.'},
 '/academia':{title:'Academia Sagamente',description:'Cursos e formações práticas em tecnologia, comunicação e criação. Comece pelos conteúdos gratuitos.'},
 '/curso/letramento-digital':{title:'Curso Gratuito de Letramento Digital',description:'Aprenda tecnologia, autonomia e cidadania digital gratuitamente com a Academia Sagamente.'},
 '/instalar':{title:'Instalar Sagamente',description:'Instale gratuitamente o Sagamente no Android, iPhone ou Windows.'},
 '/quem-somos':{title:'Quem Somos',description:'Conheça a Sagamente, nossa trajetória, soluções, métodos e projetos.'},
 '/studio':{title:'Studio & Criação',description:'Produção audiovisual, fotografia, edição, áudio e criação na Sagamente.'},
 '/design':{title:'Design & Digital',description:'Identidade visual, UI/UX, sites e presença digital na Sagamente.'},
 '/tech':{title:'Tech & Equipamentos',description:'Tecnologia, equipamentos e suporte para projetos na Sagamente.'},
 '/contato':{title:'Contato',description:'Entre em contato com a Sagamente e encontre o canal certo para sua necessidade.'},
 '/solucoes/identidade-visual':{title:'Criação de Identidade Visual para Empresas',description:'Conheça opções de logotipo e identidade visual para seu negócio e solicite uma proposta.'},
 '/solucoes/criacao-de-sites':{title:'Criação de Sites Profissionais e Landing Pages',description:'Confira sites institucionais e landing pages para sua empresa e escolha uma solução.'},
 '/solucoes/edicao-de-videos':{title:'Edição de Vídeos e Reels para Empresas',description:'Conheça as opções de edição audiovisual, reels e vídeo institucional na Sagamente.'},
}
type SeoRow={path:string;title:string;description:string;canonical_url:string|null;og_image_url:string|null;noindex:boolean;published:boolean}
export function RouteSeo(){
 const {pathname}=useLocation()
 const [remote,setRemote]=useState<SeoRow|null>(null)
 useEffect(()=>{
  let live=true
  setRemote(null)
  if(!pages[pathname])return
  void supabase.from('seo_pages')
   .select('path,title,description,canonical_url,og_image_url,noindex,published')
   .eq('path',pathname).eq('published',true).maybeSingle()
   .then(({data})=>{if(live)setRemote(data as SeoRow|null)})
  return ()=>{live=false}
 },[pathname])
 const privateRoute=/^\/(admin|app)(\/|$)/.test(pathname)
 const utilityRoute=['/abrir-app','/login','/cadastro','/email-confirmado','/esqueci-senha','/redefinir-senha','/carrinho','/comunidade'].includes(pathname)||pathname.startsWith('/certificados/')
 const page=pages[pathname]
 const info=remote?.path===pathname?remote:null
 useSeo({
  title:info?.title||page?.title||'Sagamente',
  description:info?.description||page?.description||'Plataforma integrada de tecnologia, criação, serviços, produtos e conhecimento.',
  canonicalPath:pathname,
  canonicalUrl:info?.canonical_url||null,
  image:info?.og_image_url||null,
  noindex:privateRoute||utilityRoute||Boolean(page?.noindex)||Boolean(info?.noindex),
  jsonLd:pathname==='/'?{'@context':'https://schema.org','@type':'Organization',name:'Sagamente',url:window.location.origin}:null,
 })
 return null
}
