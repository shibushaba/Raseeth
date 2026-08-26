import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { fetchProfile } from '@/data/api'
import { permissionsFor, type Permissions } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types/database'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  role: UserRole | null
  permissions: Permissions
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const next = await fetchProfile(userId)
    setProfile(next)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        loadProfile(data.session.user.id)
          .catch((err: unknown) => {
            console.error('Failed to load profile', err)
            setProfile(null)
          })
          .finally(() => {
            if (mounted) setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession?.user) {
        setLoading(true)
        loadProfile(nextSession.user.id)
          .catch((err: unknown) => {
            console.error('Failed to load profile', err)
            setProfile(null)
          })
          .finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return
    await loadProfile(session.user.id)
  }, [loadProfile, session?.user])

  const value = useMemo<AuthState>(() => {
    const role = profile?.role ?? null
    return {
      session,
      user: session?.user ?? null,
      profile,
      role,
      permissions: permissionsFor(role),
      loading,
      signIn,
      signOut,
      refreshProfile,
    }
  }, [session, profile, loading, signIn, signOut, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
