import { supabase } from "../lib/supabase"
export type Question = {
  prompt: string
  options: string[]
  correct_option: number
  points: number
  seconds: number
}
export type Assessment = {
  id: string
  module_id: string
  title: string
  kind: "activity" | "evaluation"
  instructions: string
  status: "draft" | "published"
  timed: boolean
  max_attempts: number
  passing_percent: number
}
export type Attempt = {
  attempt_id: string
  status: "in_progress" | "completed"
  position: number
  total: number
  score: number
  max_score: number
  passing_percent: number
  passed: boolean | null
  attempts_used: number
  max_attempts: number
  server_now: string
  deadline: string | null
  question: Omit<Question, "correct_option"> | null
  answers: {
    position: number
    timed_out: boolean
    awarded_points: number
  }[] | null
}
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}
export const assessmentsApi = {
  async list(moduleIds: string[]): Promise<Assessment[]> {
    if (!moduleIds.length) return []
    const { data, error } = await supabase
      .from("academy_assessments")
      .select("*")
      .in("module_id", moduleIds)
      .order("created_at")
    if (error) throw error
    return data || []
  },
  async questions(id: string): Promise<Question[]> {
    const { data, error } = await supabase
      .from("academy_questions")
      .select("prompt,options,correct_option,points,seconds")
      .eq("assessment_id", id)
      .order("display_order")
    if (error) throw error
    return data || []
  },
  async save(payload: Partial<Assessment> & { questions: Question[] }) {
    return rpc("academy_save_assessment", { payload })
  },
  async publish(id: string, published: boolean) {
    return rpc("academy_set_assessment_status", { assessment: id, published })
  },
  async start(id: string, newAttempt = false): Promise<Attempt> {
    return rpc("academy_start_assessment", {
      assessment: id,
      new_attempt: newAttempt,
    })
  },
  async answer(
    id: string,
    position: number,
    selected: number | null,
  ): Promise<Attempt> {
    return rpc("academy_answer_question", {
      attempt: id,
      question_position: position,
      selected,
    })
  },
  async results(id: string) {
    const { data, error } = await supabase
      .from("academy_attempts")
      .select(
        "id,user_id,status,score,position,started_at,completed_at,student:profiles(first_name,last_name,email)",
      )
      .eq("assessment_id", id)
      .order("started_at", { ascending: false })
    if (error) throw error
    return data || []
  },
}
