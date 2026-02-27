import { NavLink, useLocation } from 'react-router-dom'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus } from 'lucide-react'
import { useRoomsStore } from '@/store/rooms'
import { usePresenceStore } from '@/store/presence'
import { useEffect, useMemo } from 'react'
import { subscribe } from '@/store/ws'

interface ChatListProps {
  onNewDm: () => void
  unreadByRoom?: Record<string, number>
}

export function ChatList({ onNewDm, unreadByRoom = {} }: ChatListProps) {
  const { rooms, dmUsers, loading, fetch: fetchRooms, touchRoom } = useRoomsStore()
  const online = usePresenceStore((s) => s.online)
  const location = useLocation()

  // Загрузка при монтировании
  useEffect(() => {
    fetchRooms().then(r => r)
  }, [fetchRooms])

  // WS: новое сообщение → поднять комнату вверх или рефетч если неизвестна
  useEffect(() => {
    return subscribe((event) => {
      if (event.type !== 'message.new') return
      const payload = event.payload as { room_id?: string; roomId?: string; created_at?: string }
      const roomId = payload.room_id ?? payload.roomId
      if (!roomId) return
      const known = useRoomsStore.getState().rooms.some((r) => r.id === roomId)
      if (!known) {
        fetchRooms().then(r => r)
      } else {
        const at = payload.created_at ?? new Date().toISOString()
        touchRoom(roomId, at)
      }
    })
  }, [fetchRooms, touchRoom])

  const activeRoomId = useMemo(() => {
    const match = location.pathname.match(/^\/app\/dm\/([^/?#]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [location.pathname])

  const sortedRooms = useMemo(
    () => [...rooms].sort((a, b) => {
      const ta = a.last_message_at ?? a.created_at
      const tb = b.last_message_at ?? b.created_at
      return tb.localeCompare(ta)
    }),
    [rooms],
  )

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Личные сообщения</SidebarGroupLabel>
      <SidebarGroupAction onClick={onNewDm} title="Новое личное сообщение">
        <Plus />
        <span className="sr-only">Новое личное сообщение</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {loading && rooms.length === 0 && Array.from({ length: 4 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
          {sortedRooms.map((room) => {
            const dmUser = dmUsers[room.id]
            const isOnline = dmUser ? online.has(dmUser.id) : false
            const unread = unreadByRoom[room.id] ?? 0
            const label = dmUser?.display_name ?? room.name ?? 'Unknown'

            return (
              <SidebarMenuItem key={room.id} className="mb-0.5">
                <SidebarMenuButton asChild isActive={room.id === activeRoomId} size="lg">
                  <NavLink to={`/app/dm/${room.id}`}>
                    <div className="relative shrink-0">
                      <Avatar className="w-7 h-7 text-xs">
                        <AvatarImage src={dmUser?.avatar_url} alt={label} />
                        <AvatarFallback>{label[0]}</AvatarFallback>
                      </Avatar>
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-sidebar" />
                      )}
                    </div>
                    <span className="truncate">{label}</span>
                  </NavLink>
                </SidebarMenuButton>
                {unread > 0 && (
                  <SidebarMenuBadge>
                    {unread > 99 ? '99+' : unread}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
