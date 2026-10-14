import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const assetDir = join(process.cwd(), 'dist-academia', 'assets')
const cssPath = readdirSync(assetDir).filter(name => name.endsWith('.css'))
if (cssPath.length !== 1) throw new Error('Expected exactly one academy stylesheet')
const css = readFileSync(join(assetDir, cssPath[0]), 'utf8')

const required = [
 ['flex layout', /\.flex\s*\{/],
 ['grid layout', /\.grid\s*\{/],
 ['centering', /\.items-center\s*\{/],
 ['rounded cards', /\.rounded-2xl\s*\{/],
 ['login max width', /\.max-w-sm\s*\{/],
 ['form input', /\.min-h-12\s*\{/],
]
const missing = required.filter(([,rule]) => !rule.test(css)).map(([name]) => name)
if (missing.length) {
 throw new Error('Academia CSS missing layout utilities: ' + missing.join(', ') + '. Check Tailwind @source outside Vite root.')
}
console.log('Academia CSS validated:', cssPath[0], '(' + css.length + ' characters); all layout utilities present.')
