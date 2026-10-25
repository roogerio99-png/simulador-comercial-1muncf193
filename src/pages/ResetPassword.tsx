import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Sprout, CheckCircle2, AlertCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token) {
      setError('Token de redefinição não encontrado ou inválido.')
      return
    }

    if (password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setError('As senhas não coincidem.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      await pb
        .collection('simulador_comercial_users')
        .confirmPasswordReset(token, password, passwordConfirm)
      setSucesso(true)
    } catch (err: any) {
      setError(
        err?.data?.message ||
          'Não foi possível redefinir a senha. O link pode ter expirado ou ser inválido.',
      )
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
            Definir nova senha
          </CardTitle>
          <CardDescription className="text-xs text-[#5D6B63] mt-1">
            Crie sua nova senha de acesso ao simulador
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {sucesso ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-[#2E8B57]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-[#1E2A24]">
                  Senha alterada com sucesso!
                </h3>
                <p className="text-xs text-[#5D6B63]">
                  Você já pode acessar sua conta utilizando a nova senha cadastrada.
                </p>
              </div>
              <Button asChild className="w-full bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs">
                <Link to="/login">Ir para Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C0392B] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-[#1E2A24]">
                  Nova Senha (mínimo 8 dígitos)
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 text-xs border-[#E4EAE5]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="passwordConfirm" className="text-xs font-semibold text-[#1E2A24]">
                  Confirmar Nova Senha
                </Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-10 text-xs border-[#E4EAE5]"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-[#1D6A43] hover:bg-[#155C36] text-white font-semibold text-xs shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando senha...
                  </>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ResetPassword
