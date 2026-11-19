// One shared /api/status lookup (not one per letter card). `letterCheck` is true only when the server has an AI
// letter engine configured; any failure means "not available" so the browser-speech beta is offered instead.
import { api } from '../services/api.js'

let pending
export const letterCheckAvailable = () => (pending ||= api.status().then((s) => s?.letterCheck?.available === true).catch(() => { pending = undefined; return false }))
