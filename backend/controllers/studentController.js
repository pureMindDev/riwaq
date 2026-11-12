import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject } from '../utils/validate.js'

export const studentController = ({ student, assessment, revision }) => ({
  profile: asyncHandler(async (req, res) => {
    res.json({ user: req.user, student: await student.profile(req.user.id), assessment: await assessment.latest(req.user.id) })
  }),
  setProgramme: asyncHandler(async (req, res) => {
    res.json({ student: await student.setProgramme(req.user.id, bodyObject(req.body).programme) })
  }),
  updateSettings: asyncHandler(async (req, res) => {
    res.json({ student: await student.updateSettings(req.user.id, bodyObject(req.body)) })
  }),
  progress: asyncHandler(async (req, res) => res.json(await student.progress(req.user.id))),
  activity: asyncHandler(async (req, res) => res.json({ activity: await revision.recentActivity(req.user.id) })),
})
