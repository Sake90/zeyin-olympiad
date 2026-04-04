import { NextRequest, NextResponse } from 'next/server'
import { getStudentSessionFromRequest } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

const CERT_CONFIG = {
  winner: { labelRu: 'ПОБЕДИТЕЛЬ', labelKz: 'ЖЕҢІМПАЗЫ', subRu: 'Диплом I степени', subKz: 'I дәрежелі диплом', color1: '#f47920', color2: '#d4145a' },
  prize:  { labelRu: 'ПРИЗЁР',     labelKz: 'ЖҮЛДЕГЕРІ',  subRu: 'Диплом II степени', subKz: 'II дәрежелі диплом', color1: '#1ec8c8', color2: '#0fa8a8' },
  participant: { labelRu: 'УЧАСТНИК', labelKz: 'ҚАТЫСУШЫСЫ', subRu: 'Сертификат участника', subKz: 'Қатысушы куәлігі', color1: '#6b7280', color2: '#4b5563' },
} as const

type SubjectScore = { name_ru: string; name_kz: string; score: number; total: number }

function buildHtml(data: {
  full_name: string; grade?: string | null; score: number; total: number
  cert_type: keyof typeof CERT_CONFIG
  olympiad_name: string; lang: 'ru' | 'kz'; date: string; year: number
  subject_scores?: SubjectScore[]
}) {
  const cert = CERT_CONFIG[data.cert_type]
  const lang = data.lang
  const label = lang === 'kz' ? cert.labelKz : cert.labelRu
  const sub = lang === 'kz' ? cert.subKz : cert.subRu
  const certWord = lang === 'kz' ? 'КУӘЛІК' : 'СЕРТИФИКАТ'
  const givenTo = lang === 'kz' ? 'берілді' : 'выдан'
  const participatedIn = lang === 'kz' ? 'қатысқаны үшін' : 'за участие в'
  const dateLabel = lang === 'kz' ? 'Күні' : 'Дата'
  const c1 = cert.color1; const c2 = cert.color2

  // Format grade with class suffix
  const gradeDisplay = data.grade
    ? (lang === 'kz' ? `${data.grade}-сынып` : `${data.grade} класс`)
    : null

  const discountText = lang === 'kz'
    ? '🎁 Сыйлық! Олимпиада қатысушысы ретінде сізге ZEYIN oqu ortalygy-да 2026–2027 оқу жылына 10% жеңілдік берілді!'
    : '🎁 Подарок! Как участнику олимпиады, вам предоставляется скидка 10% на обучение в ZEYIN oqu ortalygy на 2026–2027 учебный год!'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&family=Roboto+Mono:wght@400;700&display=swap">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 297mm; height: 210mm; overflow: hidden; }
  body { background: #06100f; font-family: 'Roboto', sans-serif; }
  .cert {
    width: 297mm; height: 210mm;
    background: linear-gradient(135deg, #06100f 0%, #0c1a19 50%, #06100f 100%);
    border: 2px solid ${c1}40;
    display: flex; flex-direction: column;
    position: relative;
  }
  .top-line, .bot-line {
    height: 5px; width: 100%;
    background: linear-gradient(90deg, ${c2}, ${c1}, #1ec8c8, ${c1}, ${c2});
    flex-shrink: 0;
  }
  .body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 22px 52px; text-align: center; }
  .header { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .logo-ring {
    width: 90px; height: 90px; border-radius: 50%; padding: 3px;
    background: conic-gradient(${c1} 0deg, #d4145a 180deg, ${c2} 300deg, ${c1} 360deg);
    display: flex; align-items: center; justify-content: center;
  }
  .logo-inner { width: 100%; height: 100%; border-radius: 50%; background: #0a1f1e; display: flex; align-items: center; justify-content: center; }
  .org { font-family: 'Roboto Mono', monospace; font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: #4a7070; }
  .main { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .cert-word { font-family: 'Roboto Mono', monospace; font-size: 11px; letter-spacing: 6px; text-transform: uppercase; color: ${c1}; }
  .cert-level { font-size: 40px; font-weight: 900; color: ${c1}; line-height: 1; letter-spacing: -1px; }
  .cert-sub { font-family: 'Roboto Mono', monospace; font-size: 11px; color: #4a7070; margin-top: 2px; }
  .given-to { font-size: 10px; color: #1a3030; font-family: 'Roboto Mono', monospace; letter-spacing: 2px; text-transform: uppercase; }
  .student-name { font-size: 28px; font-weight: 900; color: #b2e8e8; margin-top: 2px; }
  .grade { font-family: 'Roboto Mono', monospace; font-size: 11px; color: #4a7070; margin-top: 2px; }
  .olympiad-text { font-size: 12px; color: #4a7070; }
  .olympiad-name { font-weight: 700; color: #b2e8e8; }
  .score-box {
    border: 1px solid #0f2422; background: #0c1a19;
    border-radius: 12px; padding: 8px 18px;
    font-family: 'Roboto Mono', monospace; font-size: 13px; color: ${c1};
    display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
  }
  .score-subjects { display: flex; flex-direction: column; gap: 2px; width: 100%; margin-top: 4px; }
  .score-subject-row { display: flex; justify-content: space-between; font-size: 10px; }
  .score-subject-name { color: #4a7070; }
  .score-subject-val { color: ${c1}; }
  .discount {
    width: 100%;
    background: linear-gradient(135deg, #FFD700 0%, #FFC200 100%);
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.55;
  }
  .footer { display: flex; width: 100%; align-items: flex-end; justify-content: space-between; }
  .footer-date { text-align: left; }
  .footer-brand { text-align: right; }
  .footer-label { font-family: 'Roboto Mono', monospace; font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #1a3030; }
  .footer-val { font-family: 'Roboto Mono', monospace; font-size: 10px; color: #4a7070; }
  .emoji { font-size: 28px; }
</style>
</head>
<body>
<div class="cert">
  <div class="top-line"></div>
  <div class="body">
    <div class="header">
      <div class="logo-ring">
        <div class="logo-inner">
          <svg width="52" height="32" viewBox="0 0 36 22" fill="none">
            <path d="M9 11C9 6.58172 12.5817 3 17 3C21.4183 3 25 6.58172 25 11" stroke="#1ec8c8" stroke-width="3" stroke-linecap="round"/>
            <path d="M27 11C27 15.4183 23.4183 19 19 19C14.5817 19 11 15.4183 11 11" stroke="#d4145a" stroke-width="3" stroke-linecap="round"/>
            <circle cx="18" cy="11" r="2.5" fill="#f47920"/>
          </svg>
        </div>
      </div>
      <div class="org">ZEYIN OQU ORTALYGY</div>
    </div>

    <div class="main">
      <div class="cert-word">${certWord}</div>
      <div>
        <div class="cert-level">${label}</div>
        <div class="cert-sub">${sub}</div>
      </div>
      <div>
        <div class="given-to">${givenTo}</div>
        <div class="student-name">${data.full_name}</div>
        ${gradeDisplay ? `<div class="grade">${gradeDisplay}</div>` : ''}
      </div>
      <div class="olympiad-text">
        ${participatedIn} <span class="olympiad-name">«${data.olympiad_name}»</span>
      </div>
      <div class="score-box">
        <span>⭐ ${data.score} / ${data.total} ${lang === 'kz' ? 'жұлдыз' : 'звёзд'}</span>
        ${(data.subject_scores ?? []).length > 0 ? `
        <div class="score-subjects">
          ${(data.subject_scores ?? []).map(s => `
          <div class="score-subject-row">
            <span class="score-subject-name">${lang === 'kz' ? s.name_kz : s.name_ru}</span>
            <span class="score-subject-val">⭐ ${s.score}/${s.total}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>
    </div>

    <div class="discount">${discountText}</div>

    <div class="footer">
      <div class="footer-date">
        <div class="footer-label">${dateLabel}</div>
        <div class="footer-val">${data.date}</div>
      </div>
      <div class="emoji">${data.cert_type === 'winner' ? '🥇' : data.cert_type === 'prize' ? '🥈' : '🎓'}</div>
      <div class="footer-brand">
        <div class="footer-label">ZEYIN • ${data.year}</div>
        <div class="footer-val">zeyin.kz</div>
      </div>
    </div>
  </div>
  <div class="bot-line"></div>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req)
    if (!session) return new NextResponse('Unauthorized', { status: 401 })

    const db = createServiceClient()
    const [{ data: result }, { data: student }, { data: olympiad }] = await Promise.all([
      db.from('results').select('*').eq('student_id', session.studentId).eq('olympiad_id', session.olympiadId).single(),
      db.from('students').select('full_name, grade, language').eq('id', session.studentId).single(),
      db.from('olympiads').select('name_ru, name_kz').eq('id', session.olympiadId).single(),
    ])

    if (!result || !student || !olympiad) {
      return new NextResponse('Not found', { status: 404 })
    }

    const lang = (student.language ?? session.language ?? 'ru') as 'ru' | 'kz'
    const completedAt = new Date(result.completed_at)
    const html = buildHtml({
      full_name: student.full_name,
      grade: student.grade,
      score: result.score,
      total: result.total_questions,
      cert_type: result.cert_type as keyof typeof CERT_CONFIG,
      olympiad_name: lang === 'kz' ? olympiad.name_kz : olympiad.name_ru,
      lang,
      date: completedAt.toLocaleDateString(lang === 'kz' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      year: completedAt.getFullYear(),
      subject_scores: (result.subject_scores ?? []) as SubjectScore[],
    })

    // Launch puppeteer
    let browser
    if (process.env.CHROME_EXECUTABLE_PATH) {
      // Local dev: use system Chrome
      const puppeteer = (await import('puppeteer-core')).default
      browser = await puppeteer.launch({
        executablePath: process.env.CHROME_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      })
    } else {
      // Vercel / serverless
      const chromium = (await import('@sparticuz/chromium')).default
      const puppeteer = (await import('puppeteer-core')).default
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      })
    }

    const page = await browser.newPage()
    // Set viewport to A4 landscape in pixels (96 DPI: 297mm=1123px, 210mm=794px)
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })
    await browser.close()

    const safeName = student.full_name.replace(/[^a-zA-ZА-Яа-яёЁ0-9_\- ]/g, '').slice(0, 40)
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate_${safeName}.pdf"`,
      },
    })
  } catch (e) {
    console.error('GET /api/certificate/pdf error:', e)
    return new NextResponse('PDF generation failed', { status: 500 })
  }
}
