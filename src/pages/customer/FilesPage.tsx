import { useEffect,useState } from 'react'
import { portalApi } from '../../api/portal'
import { EmptyState } from '../../components/ui/EmptyState'
export function FilesPage(){
 const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{portalApi.files().then(setRows).finally(()=>setLoading(false))},[])
 async function open(f:any){if(f.external_url){window.open(f.external_url,'_blank','noopener');return} if(f.storage_path){window.open(await portalApi.fileUrl(f.storage_path),'_blank','noopener')}}
 return <div><div className="mb-6"><h1 className="text-2xl font-bold text-white">Meus Arquivos</h1><p className="text-sm text-gray-500">Entregas e documentos liberados pela equipe</p></div>
 {loading?<p className="text-gray-400">Carregando...</p>:!rows.length?<EmptyState icon="📁" title="Nenhum arquivo ainda"/>:<div className="space-y-2">{rows.map(f=><div key={f.id} className="p-4 rounded-2xl bg-[#141416] border border-white/10 flex justify-between items-center gap-4"><div><p className="font-semibold text-white">{f.name}</p><p className="text-xs text-gray-500">{new Date(f.created_at).toLocaleDateString('pt-BR')}</p></div><button onClick={()=>open(f)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Abrir</button></div>)}</div>}</div>
}