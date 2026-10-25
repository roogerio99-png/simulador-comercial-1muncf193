import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Sprout, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Buscar redirecionamento prévio se houver
  const from = (location.state as any)?.from?.pathname || '/dashboard'

  // Parâmetro de prefill via link de primeiro acesso
  const searchParams = new URLSearchParams(location.search)
  const emailParam = searchParams.get('email') || ''

  const [email, setEmail] = useState(emailParam)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({})
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: { email?: string; password?: string; general?: string } = {}
    if (!email.trim()) {
      newErrors.email = 'Informe o seu e-mail corporativo.'
    } else if (!email.includes('@')) {
      newErrors.email = 'E-mail com formato inválido.'
    }

    if (!password) {
      newErrors.password = 'Informe sua senha de acesso.'
    } else if (password.length < 6) {
      newErrors.password = 'A senha possui no mínimo 6 caracteres.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err: any) {
      console.error('Erro no login:', err)
      setErrors({
        general: 'Credenciais inválidas. Verifique seu e-mail e senha e tente novamente.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0E301D] via-[#113A23] to-[#1D6A43]">
      <Card className="w-full max-w-[420px] bg-white border border-[#E4EAE5] shadow-2xl rounded-2xl overflow-hidden animate-fade-in-up">
        <CardHeader className="text-center pb-4 pt-8 px-6 bg-gradient-to-b from-[#F7F9F6] to-white border-b border-slate-100">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1D6A43] to-[#2E8B57] flex items-center justify-center shadow-md border border-emerald-400/30 mb-3">
            <Sprout className="w-6 h-6 text-emerald-100" />
          </div>
          <CardTitle className="text-xl font-bold text-[#1E2A24] tracking-tight">
            Acessar Simulador Comercial
          </CardTitle>
          <CardDescription className="text-xs text-[#5D6B63] mt-1">
            Entre com suas credenciais do simulador
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {errors.general && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C0392B] flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C0392B]" />
              <span>{errors.general}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-[#1E2A24]">
                E-mail Corporativo
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                }}
                className={`h-10 text-xs border-[#E4EAE5] focus-visible:ring-2 focus-visible:ring-[#1D6A43] ${
                  errors.email ? 'border-red-400 ring-1 ring-red-400' : ''
                }`}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-[11px] text-[#C0392B] font-medium">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1E2A24]">
                  Senha de Acesso
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] font-medium text-[#1D6A43] hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                  }}
                  className={`h-10 pr-9 text-xs border-[#E4EAE5] focus-visible:ring-2 focus-visible:ring-[#1D6A43] ${
                    errors.password ? 'border-red-400 ring-1 ring-red-400' : ''
                  }`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-[#C0392B] font-medium">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 mt-2 bg-[#1D6A43] hover:bg-[#155C36] text-white font-semibold text-xs tracking-wide shadow-md transition-all duration-150"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando no sistema...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-[#5D6B63]">
              Acesso exclusivo via credenciais do Simulador Comercial.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Login
