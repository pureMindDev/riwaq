import { useSyncExternalStore } from 'react'
import { prefs } from '../lib/prefs.js'

export const usePrefs = () => useSyncExternalStore(prefs.subscribe, prefs.get)
