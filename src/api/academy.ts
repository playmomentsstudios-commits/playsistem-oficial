import { supabase } from '../lib/supabase'

export type Course={id:string;title:string;slug:string;description:string|null;content_type:'course'|'video_class'|'webinar'|'lecture'|'training';status:'draft'|'published'|'archived';access_type:'free'|'manual'|'product';cover_url:string|null;cover_drive_file_id:string|null;instructor_name:string|null;estimated_minutes:number|null;created_at:string}
export const academyApi={
  async adminCourses(){const {data,error}=await supabase.from('courses').select('*').order('created_at',{ascending:false});if(error)throw error;return (data||[]) as Course[]},
  async myCourses(){const {data,error}=await supabase.from('course_enrollments').select('*,course:courses(*)').in('status',['active','completed']).order('enrolled_at',{ascending:false});if(error)throw error;return data||[]},
  async saveCourse(course:Partial<Course>){const payload={...course,updated_at:new Date().toISOString()};if(course.id){const {id,...changes}=payload;const {data,error}=await supabase.from('courses').update(changes).eq('id',id).select().single();if(error)throw error;return data as Course}const {id,...insert}=payload;const {data,error}=await supabase.from('courses').insert(insert).select().single();if(error)throw error;return data as Course},
  async modules(courseId:string){const {data,error}=await supabase.from('course_modules').select('*,lessons:course_lessons(*)').eq('course_id',courseId).order('display_order').order('display_order',{referencedTable:'course_lessons'});if(error)throw error;return data||[]},
  async addModule(courseId:string,title:string){const {data,error}=await supabase.from('course_modules').insert({course_id:courseId,title}).select().single();if(error)throw error;return data},
  async addLesson(moduleId:string,title:string){const {data,error}=await supabase.from('course_lessons').insert({module_id:moduleId,title}).select().single();if(error)throw error;return data},
}
