import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { stringParam } from '../utils/validate.js'

// "Check me" on a letter card: the learner's short recording goes to the AI letter engine; nothing is saved.
export const letterController = ({ letterEngine }) => ({
  check: asyncHandler(async (req, res) => {
    if (!letterEngine.available) throw new AppError('LETTER_ENGINE_NOT_CONFIGURED', 'The AI letter check is not available yet.', 501)
    const letter = stringParam(req.query.letter, 'letter', { max: 20 })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new AppError('INVALID_AUDIO', 'Send the recording as the request body.', 400)
    res.json(await letterEngine.check(letter, req.body, req.get('content-type')))
  }),
})
