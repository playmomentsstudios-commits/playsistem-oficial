import { projectProgress } from './projectProgress'

/** Every active task and checklist item must be closed, not only a rounded score. */
export function projectEligibleForPortfolio(project:any):boolean {
  if(!project || project.status!=='completed')return false
  const tasks=(project.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  if(!tasks.length)return false
  if(tasks.some((task:any)=>task.status!=='completed' || (task.checklist||[]).some((item:any)=>!item.completed)))return false
  return projectProgress(project)===100
}
