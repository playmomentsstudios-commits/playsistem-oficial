import {readFileSync,writeFileSync} from 'node:fs'
const specs=[
  ['supabase/migrations/20260928211000_academic_results_completion.sql','academy_refresh_my_enrollments'],
  ['supabase/migrations/20260928212000_academy_authoritative_completion_notifications.sql','academy_issue_my_certificate'],
]
let sql=''
for(const [path,name] of specs){
  const s=readFileSync(path,'utf8')
  const start=s.toLowerCase().indexOf('create or replace function public.'+name)
  if(start<0)throw new Error('Missing wrapper '+name)
  const end=s.indexOf('$$;',start)
  if(end<0)throw new Error('Unterminated wrapper '+name)
  const part=s.slice(start,end+3)
  if(!part.includes('public.academy_refresh_enrollment('))throw new Error('Unexpected wrapper '+name)
  sql+=part+'\n'
}
writeFileSync(process.argv[2],sql)
