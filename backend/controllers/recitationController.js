import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { intParam } from '../utils/validate.js'

// Practice mode on the Recitation Check page: the Muallim listens and answers, but nothing is saved.
export const recitationController = ({ recitation, engine }) => ({
  analyze: asyncHandler(async (req, res) => {
    if (!engine.available) throw new AppError('MUALLIM_UNAVAILABLE', 'The Muallim is not available yet: no recognition service is connected to this site.', 501)
    const surah = intParam(req.query.surah, 'surah', { max: 114 })
    const from = intParam(req.query.from, 'from', { max: 286 })
    const to = intParam(req.query.to, 'to', { max: 286 })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new AppError('INVALID_AUDIO', 'Send the recording as the request body.', 400)
    res.json(await recitation.practise(surah, from, to, req.body, req.get('content-type')))
  }),
})
