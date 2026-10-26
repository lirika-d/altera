import { useSyncExternalStore } from 'react'
import { appPreferencesStore } from '@/lib/appPreferences'

export function useAppPreferences() {
  return useSyncExternalStore(
    appPreferencesStore.subscribe,
    appPreferencesStore.getSnapshot,
    appPreferencesStore.getSnapshot
  )
}

