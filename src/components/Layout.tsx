import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid,
  Calculator,
  Package,
  FileStack,
  Clock,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sprout,
  ShieldCheck,
  Eye,
  Percent,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function Layout() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
    { path: '/simulate', label: 'Simular Preço', icon: Calculator },
    { path: '/products', label: 'Meus Produtos', icon: Package },
    { path: '/regras', label: 'Regras Fiscais', icon: FileStack },
    { path: '/historico', label: 'Histórico', icon: Clock },
    { path: '/configuracoes', label: 'Configurações', icon: Settings },
    ...(isAdmin ? [{ path: '/usuarios', label: 'Usuários & Convites', icon: Users }] : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Título amigável
  const currentNav = navItems.find((item) => item.path === location.pathname)
  const pageTitle = currentNav?.label || 'Simulador Comercial'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F7F9F6] text-[#1E2A24] font-sans">
      {/* ------------------------------------------------------------------ */}
      {/* SIDEBAR DESKTOP */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-[#113A23] text-white shadow-xl flex-shrink-0 z-30 transition-all duration-300 relative border-r border-[#1D6A43]/40',
          collapsed ? 'w-[76px]' : 'w-[260px]',
        )}
      >
        {/* Marca & Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#1A5734] bg-[#0E301D]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1D6A43] to-[#2E8B57] flex items-center justify-center text-white shadow-md border border-emerald-400/30 shrink-0">
              <Sprout className="w-5 h-5 text-emerald-200" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-sm tracking-tight text-white truncate leading-tight">
                  Simulador Comercial
                </h1>
                <p className="text-[10px] text-emerald-300/80 truncate font-medium">
                  Autonomia tributária para o agro
                </p>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7 text-emerald-300/80 hover:text-white hover:bg-emerald-800/40 shrink-0"
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Links de Navegação */}
        <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.path}
                      className={cn(
                        'flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-150',
                        isActive
                          ? 'bg-[#1D6A43] text-white shadow-md font-semibold'
                          : 'text-emerald-100/70 hover:bg-[#1A5734]/50 hover:text-white',
                      )}
                    >
                      <Icon
                        className={cn('w-5 h-5', isActive ? 'text-[#C98A2D]' : 'text-emerald-300')}
                      />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="font-medium text-xs bg-[#0E301D] text-white border-emerald-700"
                  >
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 relative',
                  isActive
                    ? 'bg-[#1D6A43] text-white shadow-sm font-semibold'
                    : 'text-emerald-100/80 hover:bg-[#1A5734]/50 hover:text-white',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#C98A2D] rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    'w-4.5 h-4.5 shrink-0',
                    isActive ? 'text-[#C98A2D]' : 'text-emerald-300',
                  )}
                />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Status tributário compacto */}
        {!collapsed && (
          <div className="mx-3 my-2 p-3 rounded-xl bg-[#0E301D] border border-emerald-800/40 text-[11px] text-emerald-200/80">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-300 mb-1">
              <Percent className="w-3.5 h-3.5 text-[#C98A2D]" />
              <span>Regras Fiscais 2025/2027</span>
            </div>
            <p className="text-[10px] text-emerald-300/70 leading-relaxed">
              Base ICMS, PIS/COFINS e projeção de IBS/CBS integrados.
            </p>
          </div>
        )}

        {/* Bloco Usuário Rodapé */}
        <div className="p-3 border-t border-[#1A5734] bg-[#0E301D] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="w-8 h-8 border border-emerald-500/40 shrink-0">
              <AvatarFallback className="bg-[#1D6A43] text-emerald-200 text-xs font-semibold">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : isAdmin ? 'AD' : 'AN'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Usuário Agro'}
                </p>
                <div className="flex items-center gap-1 text-[10px]">
                  {isAdmin ? (
                    <span className="text-emerald-300 font-semibold flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> Admin
                    </span>
                  ) : (
                    <span className="text-sky-300 font-medium flex items-center gap-0.5">
                      <Eye className="w-3 h-3 text-sky-400" /> Analista
                    </span>
                  )}
                  <span className="text-emerald-400/60">•</span>
                  <span className="text-emerald-300/60 truncate">{user?.email}</span>
                </div>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Sair"
            className="text-emerald-300/80 hover:text-white hover:bg-emerald-900/60 h-8 w-8 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* DRAWER MOBILE */}
      {/* ------------------------------------------------------------------ */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex flex-col w-72 bg-[#113A23] text-white h-full shadow-2xl z-10 animate-in slide-in-from-left duration-250">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A5734] bg-[#0E301D]">
              <div className="flex items-center gap-2.5">
                <Sprout className="w-6 h-6 text-emerald-300" />
                <div>
                  <span className="font-bold text-white text-sm">Simulador Comercial</span>
                  <p className="text-[10px] text-emerald-400">Autonomia tributária</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-emerald-300 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium',
                      isActive
                        ? 'bg-[#1D6A43] text-white font-semibold'
                        : 'text-emerald-100/80 hover:bg-[#1A5734]/50',
                    )}
                  >
                    <Icon className="w-5 h-5 text-emerald-400" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="p-4 border-t border-[#1A5734] bg-[#0E301D]">
              <Button
                variant="destructive"
                className="w-full justify-center gap-2 bg-[#C0392B] hover:bg-red-800 text-white"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CONTEÚDO PRINCIPAL */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Topbar */}
        <header className="h-16 bg-white border-b border-[#E4EAE5] px-4 lg:px-8 flex items-center justify-between shrink-0 shadow-sm z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-[#1E2A24] hover:bg-[#E6F2EC] rounded-lg"
              aria-label="Abrir menu lateral"
            >
              <Menu className="w-5 h-5 text-[#1D6A43]" />
            </button>
            <div className="truncate">
              <h2 className="text-base lg:text-lg font-bold text-[#1E2A24] truncate">
                {pageTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-[#E6F2EC] text-[#1D6A43] border-emerald-300"
            >
              <span className="w-2 h-2 rounded-full bg-[#1D6A43] animate-pulse" />
              App Independente
            </Badge>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <Avatar className="h-8 w-8 border border-emerald-600/30">
                <AvatarFallback className="bg-[#1D6A43] text-white text-xs font-bold">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'AG'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-xs font-medium text-[#1E2A24] truncate max-w-[140px]">
                {user?.name || user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 min-h-0 bg-[#F7F9F6] animate-fade-in-up">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="h-9 bg-white border-t border-[#E4EAE5] px-4 lg:px-8 flex items-center justify-between text-[11px] text-[#5D6B63] shrink-0">
          <span>Dados fiscais de referência — uso interno. © 2025 Simulador Comercial.</span>
          <span className="hidden sm:inline text-slate-400">v1.0.0 • Autonomia total</span>
        </footer>
      </div>
    </div>
  )
}

export default Layout
