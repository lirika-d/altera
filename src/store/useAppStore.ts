import { create } from 'zustand'
import type { ProjectFilter } from '@/types'

interface AppState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void

  projectFilter: ProjectFilter
  setProjectFilter: (filter: ProjectFilter) => void

  projectSearchQuery: string
  setProjectSearchQuery: (query: string) => void

  isCreateProjectOpen: boolean
  setIsCreateProjectOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  projectFilter: 'all',
  setProjectFilter: (filter) => set({ projectFilter: filter }),

  projectSearchQuery: '',
  setProjectSearchQuery: (query) => set({ projectSearchQuery: query }),

  isCreateProjectOpen: false,
  setIsCreateProjectOpen: (open) => set({ isCreateProjectOpen: open }),
}))
