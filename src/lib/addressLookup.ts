// Public Brazilian postal-address lookup. No personal identifiers are sent.
export type CepSuggestion = {
  cep: string
  uf: string
  localidade: string
  logradouro: string
  bairro: string
}
const digits=(s:string)=>s.replace(/\D/g,'')
export const formatCep=(value:string)=>{
  const d=digits(value).slice(0,8)
  return d.length>5?d.slice(0,5)+'-'+d.slice(5):d
}
export const normalizePlace=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR')
const toAddress=(data:Record<string,unknown>):CepSuggestion=>{
  const cep=digits(String(data.cep||''))
  const uf=String(data.uf||'').toUpperCase()
  const localidade=String(data.localidade||'').trim()
  if(cep.length!==8||!/^[A-Z]{2}$/.test(uf)||!localidade)throw new Error('Resposta de CEP inválida')
  return {cep,uf,localidade,logradouro:String(data.logradouro||'').trim(),bairro:String(data.bairro||'').trim()}
}
async function queryViaCep(url:string,signal?:AbortSignal):Promise<unknown>{
  const response=await fetch(url,{signal,headers:{Accept:'application/json'}})
  if(!response.ok)throw new Error('Consulta postal indisponível')
  const data:unknown=await response.json()
  if(!data||typeof data!=='object'||('erro' in data&&data.erro))throw new Error('CEP não encontrado')
  return data
}
export async function lookupCep(cep:string,signal?:AbortSignal):Promise<CepSuggestion>{
  const value=digits(cep)
  if(value.length!==8)throw new Error('CEP incompleto')
  const data=await queryViaCep('https://viacep.com.br/ws/'+value+'/json/',signal)
  if(Array.isArray(data)||!data||typeof data!=='object')throw new Error('Resposta postal inesperada')
  return toAddress(data as Record<string,unknown>)
}
export async function lookupStreetCeps(uf:string,city:string,street:string,signal?:AbortSignal):Promise<CepSuggestion[]>{
  if(!/^[A-Z]{2}$/.test(uf)||city.trim().length<2||street.trim().length<3)return []
  const url='https://viacep.com.br/ws/'+encodeURIComponent(uf)+'/'+encodeURIComponent(city.trim())+'/'+encodeURIComponent(street.trim())+'/json/'
  const data=await queryViaCep(url,signal)
  if(!Array.isArray(data))return []
  const unique=new Map<string,CepSuggestion>()
  for(const entry of data){
    if(!entry||typeof entry!=='object')continue
    try{
      const row=toAddress(entry as Record<string,unknown>)
      if(row.uf===uf&&normalizePlace(row.localidade)===normalizePlace(city))unique.set(row.cep,row)
    }catch{}
  }
  return [...unique.values()].slice(0,30)
}
