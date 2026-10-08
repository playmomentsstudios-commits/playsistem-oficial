import {useEffect,useState} from 'react'
import {academyApi} from '../../api/academy'
import {useToast} from '../../contexts/ToastContext'

export function CertificateReissueManager(){
 const toast=useToast();const [certs,setCerts]=useState<any[]>([]);const [requests,setRequests]=useState<any[]>([]);const [busy,setBusy]=useState('')
 const load=async()=>{try{const [c,r]=await Promise.all([academyApi.adminCertificates(),academyApi.certificateReissueRequests()]);setCerts(c);setRequests(r)}catch(e:any){toast(e.message,'error')}}
 useEffect(()=>{void load()},[])
 const reissue=async(cert:any,requestId?:string)=>{if(!confirm('Reemitir este certificado e gerar uma nova via para o aluno?'))return;try{setBusy(cert.id);const updated=await academyApi.adminReissueCertificate(cert.id,requestId,'Reemissão autorizada pelo administrador');await academyApi.certificatePdf(updated.id,'generate');toast('Nova via emitida e aluno notificado.','success');await load()}catch(e:any){toast(e.message,'error')}finally{setBusy('')}}
 const pending=requests.filter((r:any)=>r.status==='pending')
 return <section className="pm-surface p-5 mb-6">
  <div className="flex items-end justify-between gap-3 mb-4"><div><p className="text-[10px] uppercase tracking-[.16em] text-[#A65A2A] font-bold">Certificados</p><h2 className="text-lg font-bold mt-1">Emissões e reemissões</h2><p className="text-xs text-gray-600 mt-1">Audite as vias emitidas e aprove solicitações após o limite automático.</p></div><span className="pm-tag pm-tag-pending">{pending.length} pendente(s)</span></div>
  {pending.length>0&&<div className="space-y-2 mb-5">{pending.map((r:any)=>{const c=r.certificate;return <div key={r.id} className="rounded-xl border border-amber-500/15 bg-amber-500/[.03] p-3 flex flex-col md:flex-row md:items-center gap-3"><div className="flex-1"><p className="text-sm font-semibold">{c?.user?.first_name||''} {c?.user?.last_name||''}</p><p className="text-xs text-gray-500">{c?.course?.title||'Curso'} · {Number(c?.reissue_count||0)+1} emissão(ões)</p><p className="text-[10px] text-gray-600 mt-1">{r.reason||'Solicitação de nova via'}</p></div><button disabled={busy===c?.id} onClick={()=>void reissue(c,r.id)} className="min-h-9 px-3 rounded-lg bg-[#A65A2A] text-white text-xs font-bold disabled:opacity-50">Aprovar e reemitir</button></div>})}</div>}
  <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-gray-600"><tr><th className="py-2">Aluno</th><th>Curso</th><th>Vias</th><th>Última emissão</th><th className="text-right">Ação</th></tr></thead><tbody>{certs.map((c:any)=><tr key={c.id} className="border-t border-white/[.06]"><td className="py-3">{c.user?.first_name||''} {c.user?.last_name||''}<div className="text-[10px] text-gray-600">{c.user?.email}</div></td><td>{c.course?.title}</td><td>{Number(c.reissue_count||0)+1}</td><td>{new Date(c.last_reissued_at||c.issued_at).toLocaleDateString('pt-BR')}</td><td className="text-right"><button disabled={busy===c.id} onClick={()=>void reissue(c)} className="text-[#ff6573] font-bold disabled:opacity-50">Reemitir</button></td></tr>)}</tbody></table></div>
 </section>
}
