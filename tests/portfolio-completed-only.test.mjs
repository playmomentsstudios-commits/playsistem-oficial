import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const sql=read('supabase/migrations/20261008060000_portfolio_completed_projects_only.sql')
const service=read('src/services/siteContent.ts')
const eligibility=read('src/lib/portfolioEligibility.ts')
const admin=read('src/pages/admin/AdminAboutPortfolio.tsx')
test('Database public portfolio requires finalized tasks, checklists and approved card',()=>{
  assert.match(sql,/p\.status='completed'/)
  assert.match(sql,/t\.status not in \('completed','cancelled'\)/)
  assert.match(sql,/c\.completed=false/)
  assert.match(sql,/i\.source_project_id is not null/)
  assert.match(sql,/nullif\(btrim\(i\.cover_url\),''\)/)
  assert.match(sql,/drop policy if exists "public read portfolio items"/)
  assert.match(service,/supabase\.rpc\('published_portfolio_items'\)/)
})
test('Public portfolio RPC never exposes internal project ID as a result column',()=>{
  const published=sql.split('create or replace function public.published_portfolio_items()')[1]
  assert.ok(published)
  assert.doesNotMatch(published.split('as $function$')[0],/source_project_id/)
  assert.match(sql,/revoke all on function public\.portfolio_project_is_complete\(uuid\) from anon, authenticated/)
})
test('Admin requires project at 100 percent plus explicit editorial release',()=>{
  assert.match(eligibility,/project\.status!=='completed'/)
  assert.match(eligibility,/task\.status!=='completed'/)
  assert.match(eligibility,/projectProgress\(project\)===100/)
  assert.match(admin,/source_project_id/)
  assert.match(admin,/Publicar no site/)
  assert.match(admin,/active:false/)
  assert.match(admin,/portalApi\.projects/)
})
