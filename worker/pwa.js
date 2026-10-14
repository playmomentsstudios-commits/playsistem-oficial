import { PUBLIC_SEO_ROUTES, seoPage, serveSeoSitemap, serveSeoRobots, rewriteSeoHtml, isPrivateSeoRoute, preventIndexing } from './seo.js'
import { projectId, publicAnonKey } from '../utils/supabase/info.tsx'

// This is the PUBLIC Supabase anon key already used by the website.
// No secret or service role credential is bundled into this Worker.
const supabaseBase = 'https://' + projectId + '.supabase.co'
const publicHeaders = { apikey: publicAnonKey, Authorization: 'Bearer ' + publicAnonKey }
const iconColumn = {
  '/pwa/icon-180.png': 'icon_180_drive_file_id',
  '/pwa/icon-192.png': 'icon_192_drive_file_id',
  '/pwa/icon-512.png': 'icon_512_drive_file_id',
  '/pwa/maskable-512.png': 'icon_maskable_drive_file_id'
}
const fields = [
  'name', 'short_name', 'description', 'theme_color', 'background_color',
  ...Object.values(iconColumn), 'updated_at'
]
const validDriveId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(value)
const color = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback
const name = (value, fallback, limit) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback
const revision = (settings) => {
  const timestamp = Date.parse(settings.updated_at || '')
  return Number.isFinite(timestamp) ? String(timestamp) : '1'
}

async function getSettings() {
  try {
    const endpoint = supabaseBase + '/rest/v1/pwa_settings?select='
      + encodeURIComponent(fields.join(',')) + '&id=eq.true&limit=1'
    const response = await fetch(endpoint, { headers: publicHeaders, signal: AbortSignal.timeout(4000), cache: 'no-store' })
    if (!response.ok) return null
    const rows = await response.json()
    return Array.isArray(rows) && rows.length === 1 ? rows[0] : null
  } catch { return null }
}
function manifestFrom(settings) {
  const version = revision(settings)
  const icons = Object.entries(iconColumn).map(([path, key]) => ({
    src: validDriveId(settings[key]) ? path + '?v=' + version : path,
    sizes: path.includes('180') ? '180x180' : path.includes('192') ? '192x192' : '512x512',
    type: 'image/png',
    purpose: path.includes('maskable') ? 'maskable' : 'any'
  })).filter(icon => !icon.sizes.startsWith('180'))
  return {
    id: '/', name: name(settings.name, 'Sagamente', 80),
    short_name: name(settings.short_name, 'Sagamente', 24),
    description: name(settings.description, 'Tecnologia, criação e conhecimento.', 250),
    lang: 'pt-BR', display: 'standalone', scope: '/', start_url: '/abrir-app',
    theme_color: color(settings.theme_color, '#0a0a0b'),
    background_color: color(settings.background_color, '#0a0a0b'),
    categories: ['business', 'productivity', 'education'],
    icons,
    shortcuts: [
      { name: 'Minha área', url: '/abrir-app' },
      { name: 'Academia', url: '/academia' }
    ]
  }
}
async function serveIcon(request, env, settings, column) {
  const id = settings?.[column]
  if (!validDriveId(id)) return env.ASSETS.fetch(request)
  try {
    // Drive asset proxy explicitly checks the public site-asset classification.
    const endpoint = supabaseBase + '/functions/v1/google-drive-site-asset?id=' + encodeURIComponent(id)
    const source = await fetch(endpoint, {
      headers: { ...publicHeaders, Accept: 'image/png' },
      signal: AbortSignal.timeout(7000)
    })
    if (!source.ok || !source.body || !(source.headers.get('Content-Type') || '').toLowerCase().startsWith('image/png')) {
      return env.ASSETS.fetch(request)
    }
    return new Response(request.method === 'HEAD' ? null : source.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch { return env.ASSETS.fetch(request) }
}

// A same-origin bridge keeps the browser's audio/PDF loads under the same CSP
// as the Sagamente app. All entitlement and expiry checks remain on Supabase.
const academyMediaPath = '/app/academia/midia'
const isTicket = (value) => /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value || '')

async function serveAcademyMedia(request) {
  const url = new URL(request.url)
  const ticket = url.searchParams.get('ticket') || ''
  const noCache = {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin'
  }
  if (!isTicket(ticket)) {
    return new Response('Link de mídia inválido.', { status: 403, headers: noCache })
  }
  const upstreamUrl = supabaseBase + '/functions/v1/academy-library-media?ticket=' + encodeURIComponent(ticket)
  const upstreamHeaders = new Headers({
    apikey: publicAnonKey,
    Authorization: 'Bearer ' + publicAnonKey
  })
  const range = request.headers.get('Range')
  if (range) upstreamHeaders.set('Range', range)
  upstreamHeaders.set('Cache-Control', 'no-store')
  try {
    // Use a minimal RequestInit supported across Worker compatibility modes.
    // Token-bearing URLs are unique and responses must never be cached.
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'manual'
    })
    if (!upstream.ok) {
      const status = upstream.status === 401 || upstream.status === 403 ? 403 : upstream.status === 416 ? 416 : 502
      // A fixed, non-sensitive failure stage allows the reader to distinguish
      // a Drive authorization failure from an invalid ticket.
      const stage = upstream.headers.get('X-Academy-Media-Stage') || ''
      const errorHeaders = new Headers(noCache)
      if (/^[a-z_]{1,40}$/.test(stage)) errorHeaders.set('X-Academy-Media-Stage', stage)
      return new Response(
        status === 403 ? 'Acesso expirado. Atualize a página.' : 'Não foi possível carregar este arquivo.',
        { status, headers: errorHeaders }
      )
    }
    const mimeType = String(upstream.headers.get('Content-Type') || '').split(';')[0].toLowerCase()
    if (!['audio/mpeg', 'application/pdf'].includes(mimeType)) {
      return new Response('O arquivo possui um formato inesperado.', { status: 502, headers: noCache })
    }
    const headers = new Headers(noCache)
    headers.set('Content-Type', mimeType)
    headers.set('Content-Disposition', 'inline')
    headers.set('Accept-Ranges', 'bytes')
    for (const key of ['Content-Length', 'Content-Range', 'ETag', 'Last-Modified']) {
      const value = upstream.headers.get(key)
      if (value) headers.set(key, value)
    }
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      headers
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const reason = /cache mode|cache.field|RequestInitializerDict|cache_option/i.test(message)
      ? 'unsupported-fetch-cache'
      : /timeout|abort/i.test(message)
        ? 'request-aborted'
        : /redirect/i.test(message)
          ? 'upstream-redirect'
          : 'upstream-network'
    // Log a fixed category rather than a URL that might contain a private ticket.
    console.error('Academy media bridge unavailable', reason, error instanceof Error ? error.name : 'unknown')
    return new Response('Serviço de mídia temporariamente indisponível.', {
      status: 503, headers: { ...noCache, 'X-Academy-Media-Failure': reason }
    })
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    const path = new URL(request.url).pathname
    if (path === academyMediaPath) return serveAcademyMedia(request)
    if (path === '/sitemap.xml') return serveSeoSitemap(request)
    if (path === '/robots.txt') return serveSeoRobots(request)

    // Only request live app-identity settings when needed. Avoid an extra
    // Supabase request for every page, JS module, image and customer route.
    const needsPwa = path === '/' || path === '/instalar'
      || path === '/manifest.webmanifest' || Object.prototype.hasOwnProperty.call(iconColumn, path)
    const [settings, seo] = await Promise.all([
      needsPwa ? getSettings() : Promise.resolve(null),
      PUBLIC_SEO_ROUTES.has(path) ? seoPage(path) : Promise.resolve(null)
    ])

    if (path === '/manifest.webmanifest') {
      if (!settings) return env.ASSETS.fetch(request)
      const body = JSON.stringify(manifestFrom(settings))
      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers: {
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'no-cache, must-revalidate',
          'X-Content-Type-Options': 'nosniff'
        }
      })
    }
    if (Object.prototype.hasOwnProperty.call(iconColumn, path)) {
      return serveIcon(request, env, settings, iconColumn[path])
    }

    let response = await env.ASSETS.fetch(request)
    if (!response.ok || request.method === 'HEAD') return response

    if ((path === '/' || path === '/instalar') && settings) {
      const iosUrl = '/pwa/icon-180.png'
        + (validDriveId(settings.icon_180_drive_file_id) ? '?v=' + revision(settings) : '')
      if ((response.headers.get('Content-Type') || '').includes('text/html')) {
        response = new HTMLRewriter()
          .on('link[rel="apple-touch-icon"]', { element(node) { node.setAttribute('href', iosUrl) } })
          .on('meta[name="apple-mobile-web-app-title"]', { element(node) { node.setAttribute('content', name(settings.short_name, 'Sagamente', 24)) } })
          .on('meta[name="theme-color"]', { element(node) { node.setAttribute('content', color(settings.theme_color, '#0a0a0b')) } })
          .transform(response)
      }
    }

    if (seo) return rewriteSeoHtml(response, seo, request)
    if (isPrivateSeoRoute(path))return preventIndexing(response)
    return response
  }
}
