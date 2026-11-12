import { AppError } from '../utils/AppError.js'

// Requires "Authorization: Bearer <token>". Sets req.user and req.token.
export const requireAuth = (auth) => async (req, _res, next) => {
  try {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const user = token ? await auth.authenticate(token) : null
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please sign in.', 401)
    req.user = user
    req.token = token
    next()
  } catch (err) {
    next(err)
  }
}

// Loads the learner's profile. Every query downstream is scoped to req.user.id.
export const loadStudent = (student) => async (req, _res, next) => {
  try {
    req.student = await student.forUser(req.user.id)
    next()
  } catch (err) {
    next(err)
  }
}
