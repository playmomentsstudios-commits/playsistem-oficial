import { useLocation } from 'react-router-dom'
import { useSeo } from '../lib/seo'

const pages:Record<string,{title:string;description:string;noindex?:boolean}>={
 '/':{title:'Play Moments — Tecnologia, criação e conhecimento',description:'Serviços criativos, tecnologia, equipamentos e conhecimento em uma plataforma integrada.'},
 '/produtos':{title:'Produtos e Equipamentos',description:'Encontre tecnologia e equipamentos selecionados pela Play Moments para seus projetos.'},
 '/servicos':{title:'Serviços Criativos e Digitais',description:'Design, audiovisual, tecnologia e soluções digitais com acompanhamento centralizado pela Play Moments.'},
 '/academia':{title:'Academia Play Moments',description:'Cursos e formações práticas em tecnologia, comunicação e criação. Comece pelos conteúdos gratuitos.'},
 '/curso/letramento-digital':{title:'Curso Gratuito de Letramento Digital',description:'Aprenda tecnologia, autonomia e cidadania digital gratuitamente com a Academia Play Moments.'},
 '/quem-somos':{title:'Quem Somos',description:'Conheça a Play Moments, nossa trajetória, soluções, métodos e projetos.'},
 '/studio':{title:'Studio & Criação',description:'Produção audiovisual, fotografia, edição, áudio e criação na Play Moments.'},
 '/design':{title:'Design & Digital',description:'Identidade visual, UI/UX, sites e presença digital na Play Moments.'},
 '/tech':{title:'Tech & Equipamentos',description:'Tecnologia, equipamentos e suporte para projetos na Play Moments.'},
 '/contato':{title:'Contato',description:'Entre em contato com a Play Moments e encontre o canal certo para sua necessidade.'},
}
export function RouteSeo(){
 const {pathname}=useLocation()
 const privateRoute=/^\/(admin|app)(\/|$)/.test(pathname)
 const utilityRoute=['/login','/cadastro','/email-confirmado','/esqueci-senha','/redefinir-senha','/carrinho','/comunidade'].includes(pathname)||pathname.startsWith('/certificados/')
 const page=pages[pathname]
 useSeo({title:page?.title||'Play Moments',description:page?.description||'Plataforma integrada de tecnologia, criação, serviços, produtos e conhecimento.',canonicalPath:pathname,noindex:privateRoute||utilityRoute||Boolean(page?.noindex),jsonLd:pathname==='/'?{'@context':'https://schema.org','@type':'Organization',name:'Play Moments',url:window.location.origin}:null})
 return null
}
