import type { ReactNode } from 'react'

export function LoadingState({label='Carregando...'}:{label?:string}){
 return <div role="status" aria-live="polite" className="min-h-40 flex flex-col items-center justify-center gap-3 text-sm text-gray-500"><span aria-hidden="true" className="w-7 h-7 rounded-full border-2 border-[#E30613] border-t-transparent animate-spin"/><span>{label}</span></div>
}
export function ErrorState({title='Não foi possível carregar',message='Tente novamente em alguns instantes.',action}:{title?:string;message?:string;action?:ReactNode}){
 return <div role="alert" className="min-h-40 flex flex-col items-center justify-center text-center px-5"><h2 className="font-bold text-gray-200">{title}</h2><p className="text-sm text-gray-500 mt-2 max-w-md">{message}</p>{action&&<div className="mt-4">{action}</div>}</div>
}
export function EmptyState({title,message,action}:{title:string;message:string;action?:ReactNode}){
 return <div className="min-h-40 flex flex-col items-center justify-center text-center px-5"><h2 className="font-semibold text-gray-300">{title}</h2><p className="text-sm text-gray-500 mt-2 max-w-md">{message}</p>{action&&<div className="mt-4">{action}</div>}</div>
}
