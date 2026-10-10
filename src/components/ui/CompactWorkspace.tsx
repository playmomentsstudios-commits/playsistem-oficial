import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type PageHeaderProps={
  title:string
  eyebrow?:string
  description?:string
  backTo?:string
  backLabel?:string
  actions?:ReactNode
  children?:ReactNode
}

export function CompactPageHeader({title,eyebrow,description,backTo,backLabel='Voltar',actions,children}:PageHeaderProps){
  return <header className="pm-compact-header">
    {backTo&&<Link to={backTo} className="pm-compact-back">← {backLabel}</Link>}
    <div className="pm-compact-header-row">
      <div className="min-w-0 flex-1">
        {eyebrow&&<span className="pm-compact-eyebrow">{eyebrow}</span>}
        <h1 className="pm-compact-title">{title}</h1>
        {description&&<p className="pm-compact-subtitle">{description}</p>}
      </div>
      {actions&&<div className="pm-compact-actions">{actions}</div>}
    </div>
    {children&&<div className="pm-compact-header-bottom">{children}</div>}
  </header>
}

type DisclosureProps={
  title:string
  summary?:ReactNode
  children:ReactNode
  defaultOpen?:boolean
  className?:string
}
export function CompactDisclosure({title,summary,children,defaultOpen=false,className=''}:DisclosureProps){
  return <details className={'pm-compact-disclosure group '+className} open={defaultOpen||undefined}>
    <summary className="pm-compact-disclosure-trigger">
      <span className="min-w-0 font-semibold text-gray-100">{title}</span>
      {summary&&<span className="ml-auto min-w-0 truncate text-[11px] font-medium text-gray-400">{summary}</span>}
      <span aria-hidden="true" className="shrink-0 text-gray-500 transition-transform group-open:rotate-180">▾</span>
    </summary>
    <div className="pm-compact-disclosure-content">{children}</div>
  </details>
}
