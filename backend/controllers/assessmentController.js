import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject } from '../utils/validate.js'

export const assessmentController = ({ assessment }) => ({
  questions: (_req, res) => res.json({ questions: assessment.questions() }),
  submit: asyncHandler(async (req, res) => res.status(201).json({ result: await assessment.submit(req.user.id, bodyObject(req.body).answers) })),
  latest: asyncHandler(async (req, res) => res.json({ assessment: await assessment.latest(req.user.id) })),
})
