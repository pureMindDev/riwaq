import { asyncHandler } from '../utils/asyncHandler.js'
import { AppError } from '../utils/AppError.js'
import { stringParam } from '../utils/validate.js'
import { issueProof } from '../utils/voiceProof.js'

// "Check me" on a letter card: the learner's short recording goes to the AI letter engine; nothing is saved.
// A "match" also carries a short-lived signed `proof` that the spoken quiz questions accept (see utils/voiceProof.js).
export const letterController = ({ letterEngine, config }) => ({
  check: asyncHandler(async (req, res) => {
    if (!letterEngine.available) throw new AppError('LETTER_ENGINE_NOT_CONFIGURED', 'The AI letter check is not available yet.', 501)
    const letter = stringParam(req.query.letter, 'letter', { max: 20 })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new AppError('INVALID_AUDIO', 'Send the recording as the request body.', 400)
    const out = await letterEngine.check(letter, req.body, req.get('content-type'))
    res.json(out.result === 'match' ? { ...out, proof: issueProof(config.letterEngine.proofSecret, req.user.id, letter) } : out)
  }),
})
