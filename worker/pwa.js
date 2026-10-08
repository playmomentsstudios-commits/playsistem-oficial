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
    lang: 'pt-BR', display: 'standalone', scope: '/', start_url: '/',
    theme_color: color(settings.theme_color, '#0a0a0b'),
    background_color: color(settings.background_color, '#0a0a0b'),
    categories: ['business', 'productivity', 'education'],
    icons,
    shortcuts: [
      { name: 'Minha conta', url: '/app/dashboard' },
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

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request)
    const path = new URL(request.url).pathname
    const settings = await getSettings()

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
    if ((path === '/' || path === '/instalar') && settings) {
      const html = await env.ASSETS.fetch(request)
      if (!html.ok || !(html.headers.get('Content-Type') || '').includes('text/html')
          || request.method === 'HEAD') return html
      const iosUrl = '/pwa/icon-180.png' + (validDriveId(settings.icon_180_drive_file_id) ? '?v=' + revision(settings) : '')
      return new HTMLRewriter()
        .on('link[rel="apple-touch-icon"]', { element(node) { node.setAttribute('href', iosUrl) } })
        .on('meta[name="apple-mobile-web-app-title"]', { element(node) { node.setAttribute('content', name(settings.short_name, 'Sagamente', 24)) } })
        .on('meta[name="theme-color"]', { element(node) { node.setAttribute('content', color(settings.theme_color, '#0a0a0b')) } })
        .transform(html)
    }
    return env.ASSETS.fetch(request)
  }
}
