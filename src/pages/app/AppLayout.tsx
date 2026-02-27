import { useEffect } from 'react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { Outlet } from 'react-router-dom'
import { connect, disconnect } from '@/store/ws'
import AppSidebar from '@/components/app/AppSidebar'

export function AppLayout() {
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [])

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar/>
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Outlet/>
      </main>
    </SidebarProvider>
  )
}
