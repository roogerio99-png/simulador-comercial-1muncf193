import React, { createContext, useContext, useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'

export interface UserProfile {
  id: string
  email: string
  name?: string
  role?: 'admin' | 'analista'
  verified?: boolean
  avatar?: string
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAdmin: boolean
  role: 'admin' | 'analista'
  isLoading: boolean
  login: (email: string, password: string) => Promise<UserProfile>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const AUTH_COLLECTION = 'simulador_comercial_users'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [token, setToken] = useState<string | null>(pb.authStore.token)
  const [isLoading, setIsLoading] = useState(true)

  const mapRecordToUser = (record: any): UserProfile | null => {
    if (!record) return null
    return {
      id: record.id,
      email: record.email || '',
      name: record.name || record.email?.split('@')[0] || 'Usuário',
      role: (record.role as 'admin' | 'analista') || 'analista',
      verified: Boolean(record.verified),
      avatar: record.avatar || '',
    }
  }

  const checkInitialAuth = async () => {
    try {
      if (pb.authStore.isValid && pb.authStore.record) {
        // Garantir que a coleção seja exclusivamente simulador_comercial_users
        if (pb.authStore.record.collectionName === AUTH_COLLECTION) {
          setUser(mapRecordToUser(pb.authStore.record))
          setToken(pb.authStore.token)
        } else {
          // Se for de outra coleção (ex: 'users'), limpa para isolamento total
          pb.authStore.clear()
          setUser(null)
          setToken(null)
        }
      } else {
        setUser(null)
        setToken(null)
      }
    } catch (e) {
      console.error('Erro ao verificar autenticação inicial:', e)
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkInitialAuth()

    const unsubscribe = pb.authStore.onChange((tokenVal, record) => {
      setToken(tokenVal)
      if (record && record.collectionName === AUTH_COLLECTION) {
        setUser(mapRecordToUser(record))
      } else if (!record) {
        setUser(null)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string): Promise<UserProfile> => {
    // Autentica estritamente na coleção de auth PRÓPRIA deste app
    const authData = await pb.collection(AUTH_COLLECTION).authWithPassword(email.trim(), password)
    const profile = mapRecordToUser(authData.record)!
    setUser(profile)
    setToken(authData.token)
    return profile
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const refreshUser = async () => {
    if (!pb.authStore.isValid) return
    try {
      const refreshed = await pb.collection(AUTH_COLLECTION).authRefresh()
      setUser(mapRecordToUser(refreshed.record))
      setToken(refreshed.token)
    } catch {
      logout()
    }
  }

  const role: 'admin' | 'analista' = user?.role === 'admin' ? 'admin' : 'analista'
  const isAdmin = role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin,
        role,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}
