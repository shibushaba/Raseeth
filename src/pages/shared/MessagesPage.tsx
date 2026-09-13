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
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <PortalBackBar
        title="Messages"
        onBack={() => navigate(role ? homePathFor(role) : '/')}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {messagesQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-accent-soft" />
            ))}
          </div>
        ) : null}

        {messagesQuery.error ? (
          <p className="text-sm text-danger" role="alert">
            {toUserMessage(messagesQuery.error, 'Unable to load messages.')}
          </p>
        ) : null}

        {!messagesQuery.isLoading &&
        !messagesQuery.error &&
        (messagesQuery.data?.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
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
                  'max-w-[80%] rounded-2xl px-4 py-3 shadow-sm',
                  mine
                    ? 'ml-auto bg-accent text-white'
                    : 'mr-auto border border-border bg-surface',
                )}
              >
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <p className={cn('text-xs font-bold', mine ? 'text-white/80' : 'text-muted')}>
                    {roleLabel(m.sender_role)}
                  </p>
                  <p className={cn('text-[10px]', mine ? 'text-white/60' : 'text-muted')}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
                <p className={cn('whitespace-pre-wrap text-sm leading-relaxed', mine ? 'text-white' : 'text-foreground')}>
                  {m.message}
                </p>
              </div>
            )
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border bg-surface p-4"
        onSubmit={onSubmit}
      >
        <div className="flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message…"
            rows={1}
            maxLength={2000}
            aria-label="Message"
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors focus:border-accent"
          />
          {error ? (
            <p className="mt-1 text-xs text-danger" role="alert">{error}</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={send.isPending || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all active:scale-95 disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}
