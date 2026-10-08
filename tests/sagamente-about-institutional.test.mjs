import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const about=readFileSync(new URL('../src/pages/public/AboutPage.tsx',import.meta.url),'utf8')
test('Institutional hierarchy leads with Sagamente instead of founder',()=>{
  assert.match(about,/A empresa · Quem somos/)
  assert.match(about,/Criatividade que /)
  assert.match(about,/SAGAMENTE/)
  assert.match(about,/De onde viemos/)
  assert.ok(about.indexOf('Nossa essência')<about.indexOf('De onde viemos'))
})
test('Five areas link to registered routes',()=>{
  for(const route of ['/design','/tech','/studio','/servicos','/academia']){
    assert.ok(about.includes("href:'"+route+"'"))
  }
})
test('Portfolio only renders with published content and existing filters remain accessible',()=>{
  assert.match(about,/items\.length>0&&<section id="portfolio"/)
  assert.match(about,/aria-pressed=\{filter===/)
  assert.match(about,/portfolioCategories/)
})
test('Page has canonical SEO and keeps CMS founder data',()=>{
  assert.match(about,/canonicalPath:'\/quem-somos'/)
  assert.match(about,/siteContentApi\.profile/)
  assert.match(about,/profile\?\.photo_url/)
  assert.doesNotMatch(about,/projects_delivered_label|clients_served_label|satisfaction_label/)
})
