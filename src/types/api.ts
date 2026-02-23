export interface User {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  online?: boolean
}

export interface Author {
  id: string
  username: string
  display_name: string
  avatar_url?: string
}

export interface MessageReplyPreview {
  id: string
  content?: string
  author: Author
}

export interface MessageReaction {
  emoji: string
  count: number
  reacted_by_me: boolean
}

export interface Message {
  id: string
  room_id: string
  author: Author
  content?: string
  reply_to?: MessageReplyPreview
  reactions?: MessageReaction[]
  attachment?: {
    url: string
    name: string
    mime: string
    size: number
  }
  is_read?: boolean
  edited_at?: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface Session {
  id: string
  hwid: string
  created_at: string
  last_seen_at: string
}

export interface ApiError {
  error: string
}

export interface FriendRequest {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'blocked'
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  type: 'dm' | 'group'
  name?: string
  avatar_url?: string
  last_message_at?: string
  created_at: string
}

export interface Member {
  user_id: string
  role: 'owner' | 'member'
  last_read_at?: string
  joined_at: string
}

export type CallStatus = 'pending' | 'accepted' | 'declined' | 'ended' | 'missed'

export interface Call {
  id: string
  room_id: string
  caller_id: string
  status: CallStatus
  started_at?: string
  ended_at?: string
  created_at: string
}

export interface CallWithTokenResponse {
  call: Call
  token: string
  livekit_url: string
}
