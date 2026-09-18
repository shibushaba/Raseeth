import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { MissingConfigScreen } from '@/components/MissingConfigScreen'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'
import { isSupabaseConfigured } from '@/lib/supabase'
import { AppRouter } from '@/routes'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  if (!isSupabaseConfigured) {
    return <MissingConfigScreen />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
