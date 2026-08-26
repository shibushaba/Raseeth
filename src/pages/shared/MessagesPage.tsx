import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  getMessages,
  markMessagesRead,
  sendMessage,
  type MessageWithSender,
} from '@/data/api'
import { queryKeys } from '@/data/query-keys'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDateTime } from '@/lib/format'
import { logTechnicalError, toUserMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { messageSchema } from '@/validation/schemas'

function roleLabel(role: MessageWithSender['sender_role']): string {
  if (role === 'OWNER') return 'Owner'
  if (role === 'SALESMAN') return 'Salesman'
  return 'User'
}

export function MessagesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const messagesQuery = useQuery({
    queryKey: queryKeys.messages.thread,
    queryFn: getMessages,
  })

  // Opening the screen marks received unread messages as read (receiver-only RPC).
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
    <div className="mx-auto flex max-w-2xl flex-col">
      <PageHeader
        title="Messages"
        description="Simple notes between owner and salesman."
      />

      <div className="panel min-h-[40vh] flex-1 px-3 py-3">
        {messagesQuery.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse bg-neutral-100" />
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
          <p className="py-8 text-center text-sm text-muted">
            No messages yet. Send the first note below.
          </p>
        ) : null}

        <ul className="divide-y divide-border">
          {messagesQuery.data?.map((m) => {
            const mine = m.sender_id === user?.id
            return (
              <li key={m.id} className="py-3">
                <p
                  className={cn(
                    'app-kicker',
                    mine ? 'text-muted' : 'text-foreground',
                  )}
                >
                  {roleLabel(m.sender_role)}
                  {!m.is_read && m.receiver_id === user?.id ? ' · New' : ''}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {m.message}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatDateTime(m.created_at)}
                </p>
              </li>
            )
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={onSubmit}>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={3}
          maxLength={2000}
          aria-label="Message"
        />
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="md" disabled={send.isPending || !draft.trim()}>
          {send.isPending ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  )
}
