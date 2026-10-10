/** Badge do PWA: contador de notificações não lidas, nunca uma contagem estimada. */
export const BADGE_REFRESH_EVENT = 'sagamente:badge-refresh'

type BadgingNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Browser support varies: unsupported browsers retain their normal notification UI. */
export async function setUnreadAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined' || !Number.isSafeInteger(count) || count < 0) return
  const badge = navigator as BadgingNavigator
  try {
    if (count === 0) {
      if (typeof badge.clearAppBadge === 'function') await badge.clearAppBadge()
      else if (typeof badge.setAppBadge === 'function') await badge.setAppBadge(0)
    } else if (typeof badge.setAppBadge === 'function') {
      await badge.setAppBadge(count)
    }
  } catch {
    // iOS only displays badges for installed PWAs with notification permission.
  }
}

export function notifyBadgeChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(BADGE_REFRESH_EVENT))
}

/** Browser tab favicon fallback: operating systems do not expose a portable
 * API for animating an installed PWA launcher/taskbar icon. */
let faviconTimer:ReturnType<typeof setInterval>|undefined
let faviconPhase=0
let faviconCounts={messages:0,notifications:0}
function renderNotificationFavicon(){
  if(typeof document==='undefined')return
  const link=document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if(!link)return
  const {messages,notifications}=faviconCounts
  const showMessages=messages>0&&(notifications===0||faviconPhase%2===0)
  const count=showMessages?messages:notifications
  if(count===0){link.href='/favicon.svg';return}
  const label=count>99?'99+':String(count)
  const symbol=showMessages
    ? '<path d="M5 7h14v10H9l-4 3V7Z" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"/>'
    : '<path d="M12 5v10m0 4v1" stroke="white" stroke-width="2.6" stroke-linecap="round"/>'
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    +'<rect width="64" height="64" rx="14" fill="#161619"/>'
    +'<path fill="#F28C38" d="M12 17 29 8v9l-8 5 25 13v10L29 56v-9l9-6-26-14Z"/>'
    +'<path fill="#E35431" d="M31 8 49 17v10L31 17ZM12 37l17 10v9L12 47Z"/>'
    +'<circle cx="48" cy="16" r="15" fill="#D52F3C" stroke="#161619" stroke-width="3"/>'
    +(count>9?'<text x="48" y="20" text-anchor="middle" font-size="11" font-family="Arial" font-weight="bold" fill="white">'+label+'</text>':symbol.replace(/d="/g,'d="').replace(/<path /,'<path transform="translate(36 4) scale(1)" '))
    +'</svg>'
  link.href='data:image/svg+xml,'+encodeURIComponent(svg)
}
export function updateNotificationFavicon(messages:number,notifications:number):void{
  if(typeof document==='undefined')return
  faviconCounts={messages:Math.max(0,Math.floor(messages||0)),notifications:Math.max(0,Math.floor(notifications||0))}
  if(faviconTimer){clearInterval(faviconTimer);faviconTimer=undefined}
  faviconPhase=0
  renderNotificationFavicon()
  if(faviconCounts.messages>0&&faviconCounts.notifications>0){
    faviconTimer=setInterval(()=>{faviconPhase++;renderNotificationFavicon()},4500)
  }
}
