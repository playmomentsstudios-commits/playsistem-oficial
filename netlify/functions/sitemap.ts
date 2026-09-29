export default async (request:Request)=>{
 const url=new URL(request.url)
 const origin=url.origin
 const paths=['/','/produtos','/servicos','/academia','/curso/letramento-digital','/quem-somos','/studio','/design','/tech','/contato']
 const body='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>'<url><loc>'+origin+path+'</loc></url>').join('')+'</urlset>'
 return new Response(body,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=3600'}})
}
