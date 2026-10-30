import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import { Layout } from '@/components/Layout'

// Páginas de Autenticação
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import VerifyEmail from '@/pages/VerifyEmail'
import ConfirmEmailChange from '@/pages/ConfirmEmailChange'

// Páginas Autenticadas
import Dashboard from '@/pages/Dashboard'
import Simulate from '@/pages/Simulate'
import Products from '@/pages/Products'
import Regras from '@/pages/Regras'
import Importador from '@/pages/Importador'
import Historico from '@/pages/Historico'
import Configuracoes from '@/pages/Configuracoes'
import Usuarios from '@/pages/Usuarios'

import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/toaster'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rotas Públicas de Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

          {/* Redirecionamento raiz */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/dashboard" replace />
              </ProtectedRoute>
            }
          />

          {/* Rotas Protegidas dentro do Layout Principal */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/simulate" element={<Simulate />} />
            <Route path="/simulador" element={<Simulate />} />
            <Route path="/products" element={<Products />} />
            <Route path="/regras" element={<Regras />} />
            <Route path="/importador" element={<Importador />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/configuracoes" element={<Configuracoes />} />

            {/* Gestão de Usuários / Convites (Restrito a Admin) */}
            <Route
              path="/usuarios"
              element={
                <AdminRoute>
                  <Usuarios />
                </AdminRoute>
              }
            />
          </Route>

          {/* Página 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  )
}
