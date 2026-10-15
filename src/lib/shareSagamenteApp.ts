/** Public invitation: no session token, user identifier or private /app URL. */
export const SAGAMENTE_APP_INVITE_URL =
  'https://playsistem-oficial.playmomentsstudios.workers.dev/conheca-o-app'

export const SAGAMENTE_APP_INVITE_TITLE = 'Conheça o aplicativo Sagamente'

export const SAGAMENTE_APP_INVITE_TEXT =
  'Conheça a Sagamente! Encontre serviços, produtos e cursos, e tenha um espaço para acompanhar seus pedidos, projetos e materiais. O cadastro é gratuito.'

export function sagamenteWhatsAppInviteUrl():string{
  return 'https://wa.me/?text=' +
    encodeURIComponent(SAGAMENTE_APP_INVITE_TEXT+'\n\n'+SAGAMENTE_APP_INVITE_URL)
}
