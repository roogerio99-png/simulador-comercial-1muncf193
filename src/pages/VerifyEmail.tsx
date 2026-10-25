import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Sprout, CheckCircle2, AlertCircle } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [sucesso, setSucesso] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Token de validação não informado.')
      setLoading(false)
      return
    }

    const confirmar = async () => {
      try {
        await pb.collection('simulador_comercial_users').confirmVerification(token)
        setSucesso(true)
      } catch (err: any) {
        setError(
          err?.data?.message ||
            'Falha ao confirmar verificação de e-mail. Token expirado ou inválido.',
        )
      } finally {
        setLoading(false)
      }
    }

    confirmar()
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0E301D] via-[#113A23] to-[#1D6A43]">
      <Card className="w-full max-w-[420px] bg-white border border-[#E4EAE5] shadow-2xl rounded-2xl overflow-hidden animate-fade-in-up">
        <CardHeader className="text-center pb-4 pt-8 px-6 bg-gradient-to-b from-[#F7F9F6] to-white border-b border-slate-100">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1D6A43] to-[#2E8B57] flex items-center justify-center shadow-md border border-emerald-400/30 mb-3">
            <Sprout className="w-6 h-6 text-emerald-100" />
          </div>
          <CardTitle className="text-xl font-bold text-[#1E2A24] tracking-tight">
            Verificação de E-mail
          </CardTitle>
          <CardDescription className="text-xs text-[#5D6B63] mt-1">
            Confirmação de conta no Simulador Comercial
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6 text-center">
          {loading ? (
            <div className="py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#1D6A43]" />
              <p className="text-xs text-[#5D6B63]">Validando token de confirmação...</p>
            </div>
          ) : sucesso ? (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-[#2E8B57]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-[#1E2A24]">
                  E-mail verificado com sucesso!
                </h3>
                <p className="text-xs text-[#5D6B63]">
                  Sua conta no Simulador Comercial está ativa e verificada.
                </p>
              </div>
              <Button asChild className="w-full bg-[#1D6A43] hover:bg-[#155C36] text-white text-xs">
                <Link to="/login">Ir para Login</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center text-[#C0392B]">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm text-[#C0392B]">Falha na Verificação</h3>
                <p className="text-xs text-[#5D6B63]">{error}</p>
              </div>
              <Button asChild variant="outline" className="w-full text-xs">
                <Link to="/login">Voltar ao Login</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default VerifyEmail
