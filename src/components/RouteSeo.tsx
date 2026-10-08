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
}
export function RouteSeo(){
 const {pathname}=useLocation()
 const privateRoute=/^\/(admin|app)(\/|$)/.test(pathname)
 const utilityRoute=['/login','/cadastro','/email-confirmado','/esqueci-senha','/redefinir-senha','/carrinho','/comunidade'].includes(pathname)||pathname.startsWith('/certificados/')
 const page=pages[pathname]
 useSeo({title:page?.title||'Sagamente',description:page?.description||'Plataforma integrada de tecnologia, criação, serviços, produtos e conhecimento.',canonicalPath:pathname,noindex:privateRoute||utilityRoute||Boolean(page?.noindex),jsonLd:pathname==='/'?{'@context':'https://schema.org','@type':'Organization',name:'Sagamente',url:window.location.origin}:null})
 return null
}
