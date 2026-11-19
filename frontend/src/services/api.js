// The ONLY place the frontend talks to the backend. Components never call fetch directly.
const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'dt:token'

let token = null
try { token = localStorage.getItem(TOKEN_KEY) } catch { /* storage blocked: stay signed out */ }
let onUnauthorized = () => {}

export function setToken(value) {
  token = value
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}
export const getToken = () => token
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export class ApiError extends Error {
  constructor(code, message, status, extra = {}) {
    super(message)
    this.code = code
    this.status = status
    Object.assign(this, extra)
  }
}

async function request(path, { method = 'GET', body, raw, contentType } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (raw) { payload = raw; headers['Content-Type'] = contentType || raw.type || 'audio/webm' }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json' }
  let res
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the server. Check your connection.', 0)
  }
  if (res.status === 204) return null
  let json = null
  try { json = await res.json() } catch { /* not JSON */ }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    throw new ApiError(json?.error?.code || 'HTTP_ERROR', json?.error?.message || `Request failed (${res.status}).`, res.status, { conflictId: json?.error?.conflictId })
  }
  if (json === null) throw new ApiError('BAD_RESPONSE', 'The server sent an unexpected response.', res.status)
  return json
}

const json = (method, path, body) => request(path, { method, body })

export const api = {
  // public
  status: () => request('/status'),
  chapters: () => request('/chapters').then((b) => b.chapters),
  verses: (surah, from, to) => request(`/chapters/${surah}/verses?from=${from}&to=${to}`),
  audio: (surah, reciterId) => request(`/chapters/${surah}/audio?reciter=${reciterId}`).then((b) => b.audio),
  reciters: () => request('/reciters').then((b) => b.reciters),
  juzs: () => request('/juzs').then((b) => b.juzs),
  assessmentQuestions: () => request('/assessment/questions').then((b) => b.questions),

  // account
  register: (b) => json('POST', '/auth/register', b),
  login: (b) => json('POST', '/auth/login', b),
  logout: () => json('POST', '/auth/logout'),
  me: () => request('/auth/me').then((b) => b.user),
  deleteAccount: () => json('DELETE', '/auth/me'),

  // student
  student: () => request('/student'),
  setProgramme: (programme) => json('PATCH', '/student/programme', { programme }).then((b) => b.student),
  updateSettings: (b) => json('PATCH', '/student/settings', b).then((r) => r.student),
  progress: () => request('/student/progress'),
  activity: () => request('/student/activity').then((b) => b.activity),
  submitAssessment: (answers) => json('POST', '/assessment', { answers }).then((b) => b.result),
  plan: () => request('/plan/today').then((b) => b.plan),

  // foundation
  lessons: () => request('/foundation/lessons').then((b) => b.lessons),
  lesson: (id) => request(`/foundation/lessons/${id}`).then((b) => b.lesson),
  submitQuiz: (id, answers) => json('POST', `/foundation/lessons/${id}/quiz`, { answers }),
  completeLesson: (id) => json('POST', `/foundation/lessons/${id}/complete`),
  submitLessonRecitation: (id, blob) => request(`/foundation/lessons/${id}/recitation`, { method: 'POST', raw: blob }),

  // tahfidh
  passages: () => request('/tahfidh/passages').then((b) => b.passages),
  passage: (id) => request(`/tahfidh/passages/${id}`).then((b) => b.passage),
  addPassage: (b) => json('POST', '/tahfidh/passages', b).then((r) => r.passage),
  removePassage: (id) => json('DELETE', `/tahfidh/passages/${id}`),
  markMemorised: (id, selfDeclared) => json('POST', `/tahfidh/passages/${id}/memorised`, selfDeclared ? { selfDeclared } : {}).then((b) => b.passage),
  setPassageStatus: (id, status) => json('PATCH', `/tahfidh/passages/${id}/status`, { status }).then((b) => b.passage),
  logSession: (id) => json('POST', `/tahfidh/passages/${id}/session`),
  setPosition: (id, verse) => json('PATCH', `/tahfidh/passages/${id}/position`, { verse }),
  declareJuz: (juz) => json('POST', '/tahfidh/declare-juz', { juz }),
  passageRecitations: (id) => request(`/tahfidh/passages/${id}/recitations`).then((b) => b.recitations),
  submitRecitation: (id, blob) => request(`/tahfidh/passages/${id}/recitations`, { method: 'POST', raw: blob }),

  // muraja'ah
  murajaah: () => request('/murajaah'),
  completeRevision: (id, input) => json('POST', `/murajaah/passages/${id}/complete`, input).then((b) => b.passage),
  setDueDate: (id, dueDate) => json('PATCH', `/murajaah/passages/${id}/schedule`, { dueDate }).then((b) => b.passage),
  history: () => request('/murajaah/history').then((b) => b.history),

  // milestones
  milestones: () => request('/milestones').then((b) => b.milestones),
  milestone: (id) => request(`/milestones/${id}`).then((b) => b.milestone),
  rateMilestoneItem: (mid, iid, input) => json('POST', `/milestones/${mid}/assessment/${iid}`, input).then((b) => b.milestone),

  // recitation (signed in)
  checkLetter: (letterId, blob) => request(`/letters/check?letter=${encodeURIComponent(letterId)}`, { method: 'POST', raw: blob }),
  analyze: (blob, surah, from, to) => request(`/recitation/analyze?surah=${surah}&from=${from}&to=${to}`, { method: 'POST', raw: blob }),
}

// Plain-language messages. Server messages are already written for learners.
export function friendlyError(err) {
  switch (err?.code) {
    case 'PROVIDER_NOT_CONFIGURED':
      return "The Qur'an service has not been set up on the server yet, so text and audio can't load."
    case 'PROVIDER_AUTH':
    case 'PROVIDER_FORBIDDEN':
      return "The server couldn't get access to the Qur'an service. The site owner needs to check its settings."
    case 'PROVIDER_UNREACHABLE':
    case 'PROVIDER_ERROR':
    case 'PROVIDER_RATE_LIMITED':
      return "The Qur'an service isn't responding right now. Please try again in a moment."
    default:
      return err?.message || 'Something went wrong.'
  }
}
