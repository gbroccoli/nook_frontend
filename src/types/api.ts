export interface User {
  id: string
  username: string
  display_name: string
  avatar_url?: string
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
