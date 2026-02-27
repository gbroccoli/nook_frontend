import { Settings, Users } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { ChatList } from '@/components/app/ChatList'
import { SettingsModal } from '@/pages/app/SettingsPage'
import { Logo } from '@/components/ui/Logo'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'


const AppSidebar = () => {
  const user = useAuthStore((s) => s.user)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <Sidebar>
        <SidebarHeader className="px-4 py-3 border-b border-elevated/50">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-pixel text-[18px] text-primary tracking-wide">nook</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/app" end>
                      <Users />
                      <span>Друзья</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <ChatList onNewDm={() => {}} />
        </SidebarContent>
        <SidebarFooter className={"p-0"}>
          <div className={"flex items-center justify-between gap-2 bg-[#0F1215] px-2 py-4"}>
            <div className={"flex items-center gap-2"}>
              <Avatar>
                <AvatarImage src={user?.avatar_url} />
                <AvatarFallback>{user?.username}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className={"text-sm"}>{user?.display_name}</h2>
                <div className={"text-xs"}>@{user?.username}</div>
              </div>
            </div>
            <div>
              <Button type={"button"} variant={"ghost"} onClick={() => setSettingsOpen(true)}>
                <Settings size={15} />
              </Button>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}


export default AppSidebar
