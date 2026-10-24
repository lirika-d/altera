import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ActiveSessionBanner } from './ActiveSessionBanner'
import { CreateProjectDialog } from '@/components/shared/CreateProjectDialog'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Layout() {
  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-bg-base text-text-primary">
        {/* Left Collapsible Sidebar */}
        <Sidebar />

        {/* Right Main Area */}
        <div className="flex flex-col flex-1 h-screen overflow-hidden min-w-0">
          <Header />
          <ActiveSessionBanner />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>

        {/* Global Dialogs */}
        <CreateProjectDialog />
      </div>
    </TooltipProvider>
  )
}
