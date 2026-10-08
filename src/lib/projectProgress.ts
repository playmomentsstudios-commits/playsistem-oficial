/** A single progress calculation for project cards and project details. */
export function projectProgress(project:any):number {
  const tasks=(project?.tasks||[]).filter((task:any)=>task.status!=='cancelled')
  const checklist=tasks.flatMap((task:any)=>task.checklist||[])
  if(checklist.length)return Math.round(checklist.filter((item:any)=>item.completed).length/checklist.length*100)
  return tasks.length?Math.round(tasks.filter((task:any)=>task.status==='completed').length/tasks.length*100):0
}
