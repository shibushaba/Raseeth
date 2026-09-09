import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquare, Send } from 'lucide-react'

import { PortalBackBar } from '@/components/ui/portal-field'
import {
  getMessages,
  markMessagesRead,
  sendMessage,
  type MessageWithSender,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatTime } from '@/lib/datetime'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { homePathFor } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { messageSchema } from '@/validation/schemas'

function roleLabel(role: MessageWithSender['sender_role']): string {
  if (role === 'OWNER') return 'Owner'
  if (role === 'SALESMAN') return 'Salesman'
  return 'User'
}

export function MessagesPage() {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const messagesQuery = useQuery({
    queryKey: queryKeys.messages.thread,
    queryFn: getMessages,
  })

  useEffect(() => {
    let cancelled = false
    void markMessagesRead()
      .then(async () => {
        if (cancelled) return
        await queryClient.invalidateQueries({
          queryKey: queryKeys.messages.unreadCount,
        })
        await queryClient.invalidateQueries({
          queryKey: queryKeys.messages.thread,
        })
      })
      .catch((err: unknown) => {
        logTechnicalError('markMessagesRead', err)
      })
    return () => {
      cancelled = true
    }
  }, [queryClient])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesQuery.data?.length])

  const send = useMutation({
    mutationFn: sendMessage,
    onSuccess: async () => {
      setDraft('')
      setError(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.thread }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.messages.unreadCount,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity.all }),
      ])
    },
    onError: (err) => {
      logTechnicalError('sendMessage', err)
      setError(
        toUserMessage(err, "You don't have permission to send this message."),
      )
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = messageSchema.safeParse({ message: draft })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please enter a valid message.')
      return
    }
    send.mutate(parsed.data)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-lg flex-col">
      <PortalBackBar
        title="Messages"
        subtitle="Notes between owner and salesman"
        onBack={() => navigate(role ? homePathFor(role) : '/')}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {messagesQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-violet-50" />
            ))}
          </div>
        ) : null}

        {messagesQuery.error ? (
          <p className="text-sm text-red-600" role="alert">
            {toUserMessage(messagesQuery.error, 'Unable to load messages.')}
          </p>
        ) : null}

        {!messagesQuery.isLoading &&
        !messagesQuery.error &&
        (messagesQuery.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
            <MessageSquare className="h-8 w-8" aria-hidden />
            <p className="font-semibold">No messages yet</p>
            <p className="text-xs">Send the first note below</p>
          </div>
        ) : null}

        <div className="space-y-3">
          {messagesQuery.data?.map((m) => {
            const mine = m.sender_id === user?.id
            return (
              <div
                key={m.id}
                className={cn(
                  'rounded-2xl border p-4 shadow-sm',
                  mine
                    ? 'ml-8 border-violet-100 bg-violet-50'
                    : 'mr-8 border-emerald-100 bg-white',
                )}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-bold text-gray-600">
                    {roleLabel(m.sender_role)}
                    {!m.is_read && m.receiver_id === user?.id ? (
                      <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        New
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {formatTime(m.created_at)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                  {m.message}
                </p>
              </div>
            )
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        className="space-y-2 border-t border-violet-100 bg-white p-4"
        onSubmit={onSubmit}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={2}
          maxLength={2000}
          aria-label="Message"
          className="w-full resize-none rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-violet-400"
        />
        {error ? (
          <p className="text-sm text-red-600" role="alert">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={send.isPending || !draft.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 font-extrabold text-white disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
