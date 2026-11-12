import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject, stringParam } from '../utils/validate.js'

export const foundationController = ({ foundation, recitation }) => ({
  list: asyncHandler(async (req, res) => res.json({ lessons: await foundation.list(req.user.id) })),
  get: asyncHandler(async (req, res) => res.json({ lesson: await foundation.get(req.user.id, stringParam(req.params.id, 'lesson', { max: 40 })) })),
  quiz: asyncHandler(async (req, res) => res.json(await foundation.submitQuiz(req.user.id, req.params.id, bodyObject(req.body).answers))),
  recitation: asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: { code: 'INVALID_AUDIO', message: 'Send the recording as the request body.' } })
    res.status(201).json(await recitation.submitForLesson(req.user.id, req.params.id, req.body, req.get('content-type')))
  }),
  complete: asyncHandler(async (req, res) => res.json(await foundation.complete(req.user.id, req.student.timezone, req.params.id))),
})
