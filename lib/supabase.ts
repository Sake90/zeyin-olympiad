import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client (anon key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-only client (service role, bypasses RLS) — use only in API routes
export function createServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[supabase] MISSING ENV VARS:', {
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'OK' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: supabaseServiceKey ? 'OK' : 'MISSING',
    })
    throw new Error('Supabase env vars not configured')
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type OlympiadStatus = 'draft' | 'registration' | 'active' | 'finished'
export type Language = 'kz' | 'ru'
export type QuestionType = 'test' | 'video' | 'task'
export type CertType = 'winner' | 'prize' | 'participant'

export interface Olympiad {
  id: string
  name_ru: string
  name_kz: string
  subject: string | null
  start_time: string | null
  duration_minutes: number
  status: OlympiadStatus
  intro_video_url_ru: string | null
  intro_video_url_kz: string | null
  intro_text_ru: string | null
  intro_text_kz: string | null
  outro_video_url_ru: string | null
  outro_video_url_kz: string | null
  cert_range_winner_min: number
  cert_range_prize_min: number
  cert_range_pass_min: number
  target_grades: string[]
  created_at: string
}

export interface Student {
  id: string
  full_name: string
  school: string | null
  grade: string | null
  language: Language
  login: string
  password_hash: string
  password_plain: string
  olympiad_id: string | null
  registered_at: string
  whatsapp: string | null
}

export interface Question {
  id: string
  olympiad_id: string
  type: QuestionType
  question_ru: string
  question_kz: string
  option_a_ru: string
  option_b_ru: string
  option_c_ru: string
  option_d_ru: string
  option_a_kz: string
  option_b_kz: string
  option_c_kz: string
  option_d_kz: string
  correct_option: 'a' | 'b' | 'c' | 'd'
  youtube_url_ru: string | null
  youtube_url_kz: string | null
  image_url: string | null
  order_num: number
}

export interface Session {
  id: string
  student_id: string
  olympiad_id: string
  started_at: string
  time_remaining_seconds: number
  last_question_num: number
  is_completed: boolean
}

export interface Answer {
  id: string
  student_id: string
  question_id: string
  selected_option: 'a' | 'b' | 'c' | 'd' | null
  answered_at: string
}

export interface Result {
  id: string
  student_id: string
  olympiad_id: string
  score: number
  total_questions: number
  cert_type: CertType
  passed_to_round2: boolean
  completed_at: string
}
