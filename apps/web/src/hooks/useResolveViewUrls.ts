import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

export function useResolveViewUrls(urls: string[]) {
  const sortedKey = useMemo(() => [...new Set(urls)].sort().join('\0'), [urls])
  return useQuery({
    queryKey: ['resolve-views', sortedKey],
    queryFn: async () => {
      const unique = [...new Set(urls)]
      if (unique.length === 0) return {}
      const { data } = await api.post<{ data: { resolved: Record<string, string> } }>(
        '/upload/resolve-views',
        { urls: unique },
      )
      return data.data.resolved
    },
    enabled: urls.length > 0,
  })
}
