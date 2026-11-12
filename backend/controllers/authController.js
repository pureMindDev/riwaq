import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject } from '../utils/validate.js'

export const authController = ({ auth }) => ({
  register: asyncHandler(async (req, res) => {
    const { token, expiresAt, user } = await auth.register(bodyObject(req.body))
    res.status(201).json({ token, expiresAt, user })
  }),
  login: asyncHandler(async (req, res) => {
    const { token, expiresAt, user } = await auth.login(bodyObject(req.body))
    res.json({ token, expiresAt, user })
  }),
  logout: asyncHandler(async (req, res) => {
    await auth.logout(req.token)
    res.status(204).end()
  }),
  me: (req, res) => res.json({ user: req.user }),
  remove: asyncHandler(async (req, res) => {
    await auth.deleteAccount(req.user.id)
    res.status(204).end()
  }),
})
