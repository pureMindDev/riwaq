import { asyncHandler } from '../utils/asyncHandler.js'
import { bodyObject, objectIdParam } from '../utils/validate.js'

export const tahfidhController = ({ passages, recitation }) => ({
  list: asyncHandler(async (req, res) => res.json({ passages: await passages.list(req.user.id, req.student.timezone) })),
  get: asyncHandler(async (req, res) => res.json({ passage: await passages.get(req.user.id, req.student.timezone, objectIdParam(req.params.id)) })),
  add: asyncHandler(async (req, res) => res.status(201).json({ passage: await passages.add(req.user.id, req.student.timezone, bodyObject(req.body)) })),
  markMemorised: asyncHandler(async (req, res) =>
    res.json({ passage: await passages.markMemorised(req.user.id, req.student.timezone, objectIdParam(req.params.id), { selfDeclared: req.body?.selfDeclared === true }) })),
  setStatus: asyncHandler(async (req, res) =>
    res.json({ passage: await passages.setStatus(req.user.id, req.student.timezone, objectIdParam(req.params.id), bodyObject(req.body).status) })),
  session: asyncHandler(async (req, res) => res.json({ passage: await passages.logSession(req.user.id, req.student.timezone, objectIdParam(req.params.id)) })),
  position: asyncHandler(async (req, res) => res.json(await passages.setPosition(req.user.id, objectIdParam(req.params.id), bodyObject(req.body).verse))),
  remove: asyncHandler(async (req, res) => {
    await passages.remove(req.user.id, objectIdParam(req.params.id))
    res.status(204).end()
  }),
  declareJuz: asyncHandler(async (req, res) =>
    res.status(201).json(await passages.declareJuz(req.user.id, req.student.timezone, bodyObject(req.body).juz, req.student.dailyTarget.revisionVerses))),
  recitations: asyncHandler(async (req, res) => res.json({ recitations: await passages.recitations(req.user.id, objectIdParam(req.params.id)) })),
  submitRecitation: asyncHandler(async (req, res) => {
    const audio = req.body
    if (!Buffer.isBuffer(audio) || audio.length === 0) return res.status(400).json({ error: { code: 'INVALID_AUDIO', message: 'Send the recording as the request body.' } })
    res.status(201).json(await recitation.submitForPassage(req.user.id, objectIdParam(req.params.id), audio, req.get('content-type')))
  }),
})
