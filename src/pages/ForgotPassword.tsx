import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Sprout, ArrowLeft, CheckCircle2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Informe um e-mail válido.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      await pb.collection('simulador_comercial_users').requestPasswordReset(email.trim())
      setEnviado(true)
    } catch (err) {
      // Por segurança sempre confirma para não expor enumeração de e-mails
      setEnviado(true)
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
            Recuperar senha
          </CardTitle>
          <CardDescription className="text-xs text-[#5D6B63] mt-1">
            Digite seu e-mail cadastrado no simulador
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {enviado ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-[#2E8B57]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-[#1E2A24]">Instruções enviadas!</h3>
                <p className="text-xs text-[#5D6B63]">
                  Se o e-mail existir no sistema, você receberá um link seguro para redefinir sua
                  senha.
                </p>
              </div>
              <Button asChild className="w-full bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs">
                <Link to="/login">Voltar para o Login</Link>
              </Button>
            </div>
          ) : (
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
                    if (error) setError(null)
                  }}
                  className={`h-10 text-xs border-[#E4EAE5] ${error ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                />
                {error && <p className="text-[11px] text-[#C0392B] font-medium">{error}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-[#1D6A43] hover:bg-[#155C36] text-white font-semibold text-xs shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando link...
                  </>
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#1D6A43] hover:underline font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para o Login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ForgotPassword
