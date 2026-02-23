import { api } from './client'
import type { Call, CallWithTokenResponse } from '@/types/api'

export const callsApi = {
  start: (roomId: string) =>
    api.post<CallWithTokenResponse>(`/rooms/${roomId}/calls`, {}),

  active: (roomId: string) =>
    api.get<{ call: Call }>(`/rooms/${roomId}/calls/active`),

  accept: (callId: string) =>
    api.post<CallWithTokenResponse>(`/calls/${callId}/accept`, {}),

  decline: (callId: string) =>
    api.post<{ call: Call }>(`/calls/${callId}/decline`, {}),

  end: (callId: string) =>
    api.post<{ call: Call }>(`/calls/${callId}/end`, {}),
}
