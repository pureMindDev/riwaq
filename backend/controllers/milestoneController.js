import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject, objectIdParam } from '../utils/validate.js'

export const milestoneController = ({ milestones }) => ({
  list: asyncHandler(async (req, res) => res.json({ milestones: await milestones.list(req.user.id, req.student.timezone) })),
  get: asyncHandler(async (req, res) => res.json({ milestone: await milestones.get(req.user.id, objectIdParam(req.params.id)) })),
  rate: asyncHandler(async (req, res) =>
    res.json({ milestone: await milestones.rateAssessmentItem(req.user.id, req.student.timezone, objectIdParam(req.params.id), objectIdParam(req.params.itemId, 'itemId'), (({ submissionId, rating }) => ({ submissionId, rating }))(bodyObject(req.body))) })),
})
