import { asyncHandler } from '../utils/asyncHandler.js'

export const planController = ({ plan }) => ({
  today: asyncHandler(async (req, res) => res.json({ plan: await plan.today(req.user.id) })),
})
