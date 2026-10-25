import React, { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface ScrollableTableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  scrollClassName?: string
  maxHeight?: string
  minHeight?: string
  showFloatingHorizontalBar?: boolean
  hideFloatingBarOnTouch?: boolean
  hideVerticalScrollbar?: boolean
  autoFitHeight?: boolean
  bottomOffset?: number
  onNearBottom?: () => void
  bottomThreshold?: number
  containerRef?: React.RefObject<HTMLDivElement>
}

/**
 * ScrollableTable
 *
 * Componente contêiner para tabelas largas e longas espelhado do app de referência.
 */
export function ScrollableTable({
  children,
  className,
  scrollClassName,
  maxHeight,
  minHeight = '220px',
  showFloatingHorizontalBar = false,
  hideFloatingBarOnTouch: _hideFloatingBarOnTouch = false,
  hideVerticalScrollbar = false,
  autoFitHeight = true,
  bottomOffset = 64,
  onNearBottom,
  bottomThreshold = 200,
  containerRef: externalContainerRef,
  style,
  ...props
}: ScrollableTableProps) {
  const rootWrapperRef = useRef<HTMLDivElement>(null)
  const internalContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = externalContainerRef || internalContainerRef
  const [computedMaxHeight, setComputedMaxHeight] = useState<string | undefined>(undefined)

  const handleNativeScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    if (onNearBottom) {
      const scrollBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (scrollBottom <= bottomThreshold) {
        onNearBottom()
      }
    }
  }, [containerRef, onNearBottom, bottomThreshold])

  const updateAvailableHeight = useCallback(() => {
    if (!autoFitHeight) return

    const wrapper = rootWrapperRef.current
    if (!wrapper) return

    const rect = wrapper.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const reservedBottom = bottomOffset + (showFloatingHorizontalBar ? 44 : 8)
    const available = viewportHeight - rect.top - reservedBottom

    const targetHeight = Math.max(180, Math.floor(available))
    setComputedMaxHeight(`${targetHeight}px`)
  }, [autoFitHeight, bottomOffset, showFloatingHorizontalBar])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    updateAvailableHeight()

    const resizeObserver = new ResizeObserver(() => {
      updateAvailableHeight()
    })

    resizeObserver.observe(el)
    if (el.firstElementChild) {
      resizeObserver.observe(el.firstElementChild)
    }
    if (rootWrapperRef.current) {
      resizeObserver.observe(rootWrapperRef.current)
    }

    const handleWindowResize = () => {
      updateAvailableHeight()
    }

    window.addEventListener('resize', handleWindowResize)
    window.addEventListener('scroll', updateAvailableHeight, { passive: true })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleWindowResize)
      window.removeEventListener('scroll', updateAvailableHeight)
    }
  }, [updateAvailableHeight, containerRef])

  const effectiveMaxHeight =
    maxHeight && maxHeight !== 'auto' && maxHeight !== 'none'
      ? maxHeight
      : autoFitHeight && computedMaxHeight
        ? computedMaxHeight
        : maxHeight === 'none'
          ? undefined
          : 'calc(100vh - 280px)'

  const containerHeightStyle: React.CSSProperties = {
    ...(effectiveMaxHeight ? { maxHeight: effectiveMaxHeight } : {}),
    ...(minHeight ? { minHeight } : {}),
    flex: '1 1 auto',
  }

  return (
    <div
      ref={rootWrapperRef}
      className={cn('relative w-full flex flex-col group/scrollable', className)}
      style={style}
      {...props}
    >
      <div
        ref={containerRef}
        onScroll={handleNativeScroll}
        style={containerHeightStyle}
        className={cn(
          'w-full overflow-x-auto overflow-y-auto relative',
          '[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-20 [&_thead]:bg-[#F5F7F1] [&_thead_th]:bg-[#F5F7F1]',
          '[&_thead_th]:shadow-[0_1px_0_0_#DCE5DC]',
          '[&::-webkit-scrollbar:horizontal]:hidden [&::-webkit-scrollbar:horizontal]:h-0',
          hideVerticalScrollbar
            ? 'no-scrollbar-vertical [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'custom-scrollbar',
          scrollClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
