export const statusPedido: Record<string,string> = {
  pending:'Pendente',
  awaiting_payment:'Aguardando pagamento',
  paid:'Pago',
  processing:'Em processamento',
  in_production:'Em produção',
  ready:'Pronto',
  completed:'Concluído',
  cancelled:'Cancelado',
  refunded:'Reembolsado',
}

export const statusPagamento: Record<string,string> = {
  pending:'Aguardando pagamento',
  awaiting_confirmation:'Comprovante enviado — aguardando confirmação',
  paid:'Pagamento recebido',
  rejected:'Comprovante recusado',
  cancelled:'Cancelado',
  refunded:'Reembolsado',
}

export const metodoPagamento: Record<string,string> = {
  pix_manual:'PIX manual',
  pix_gateway:'PIX online',
  card:'Cartão',
}

export const statusComprovante: Record<string,string> = {
  pending:'Em análise',
  approved:'Aprovado',
  rejected:'Recusado',
}

export const statusOrcamento: Record<string,string> = {
  draft:'Rascunho',
  sent:'Enviado',
  viewed:'Visualizado',
  accepted:'Aceito',
  rejected:'Recusado',
  expired:'Expirado',
}

export const statusProjeto: Record<string,string> = {
  planning:'Planejamento',
  active:'Em andamento',
  paused:'Pausado',
  review:'Em revisão',
  completed:'Concluído',
  cancelled:'Cancelado',
}

export const statusEtapa: Record<string,string> = {
  pending:'Pendente',
  in_progress:'Em andamento',
  completed:'Concluída',
}

export const statusTarefa: Record<string,string> = {
  pending:'Pendente',
  in_progress:'Em andamento',
  review:'Em revisão',
  completed:'Concluída',
  cancelled:'Cancelada',
}

export const prioridade: Record<string,string> = {
  low:'Baixa',
  medium:'Média',
  high:'Alta',
  urgent:'Urgente',
}

export const tipoProjeto: Record<string,string> = {
  internal:'Interno',
  product:'Produto',
  service:'Serviço',
  website:'Website',
  design:'Design',
  audiovisual:'Audiovisual',
  other:'Outro',
}

export const tipoPrecoServico: Record<string,string> = {
  fixed:'Preço fixo',
  starting_at:'A partir de',
  quote:'Sob orçamento',
}

export const statusPublicacao: Record<string,string> = {
  draft:'Rascunho',
  published:'Publicado',
  archived:'Arquivado',
}

export function rotulo(map:Record<string,string>,value?:string|null){
  if(!value)return '—'
  return map[value] ?? value.split('_').join(' ')
}
