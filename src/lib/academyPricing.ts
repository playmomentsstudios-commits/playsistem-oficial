export type AcademyWorkPrice={
 release_code:string;ebook_cents:number;audiobook_cents:number;combo_cents:number;checkout_enabled:boolean
}

const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const percentage=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1})
export const formatAcademyMoney=(cents:number)=>currency.format(cents/100)

export function academyComboSavings(price:Pick<AcademyWorkPrice,'ebook_cents'|'audiobook_cents'|'combo_cents'>|null){
 if(!price||![price.ebook_cents,price.audiobook_cents,price.combo_cents]
  .every(value=>Number.isSafeInteger(value)&&value>0))return null
 const separateCents=price.ebook_cents+price.audiobook_cents
 const savingCents=separateCents-price.combo_cents
 if(!Number.isSafeInteger(separateCents)||savingCents<=0)return null
 return {separateCents,savingCents,percentage:percentage.format(savingCents/separateCents*100)}
}
