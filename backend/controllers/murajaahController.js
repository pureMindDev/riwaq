import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject, objectIdParam } from '../utils/validate.js'

export const murajaahController = ({ revision }) => ({
  overview: asyncHandler(async (req, res) => res.json(await revision.overview(req.user.id, req.student.timezone))),
  complete: asyncHandler(async (req, res) => {
    const b = bodyObject(req.body)
    res.json({ passage: await revision.complete(req.user.id, req.student.timezone, objectIdParam(req.params.id), { submissionId: b.submissionId, rating: b.rating, flag: b.flag === true }) })
  }),
  schedule: asyncHandler(async (req, res) =>
    res.json({ passage: await revision.setDueDate(req.user.id, req.student.timezone, objectIdParam(req.params.id), bodyObject(req.body).dueDate) })),
  history: asyncHandler(async (req, res) => res.json({ history: await revision.history(req.user.id) })),
})
