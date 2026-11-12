import { useSyncExternalStore } from 'react'
import { store } from '../lib/store.js'

export function useStoreState() {
  return useSyncExternalStore(store.subscribe, store.getState)
}
