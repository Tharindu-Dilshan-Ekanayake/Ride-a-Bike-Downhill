import { useEffect } from 'react'

import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** How long a toast stays up: five seconds, then it's gone. */
const TOAST_MS = 5000

/** A celebration banner across the top-middle: a new bike, an ad reward, a Gems purchase. */
export function Toast() {
  const toast = useGame((s) => s.toast)
  // Not over an open menu (the menu has the floor; the toast's five seconds still run).
  const panelOpen = useGame((s) => s.panel !== null)
  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => {
      if (useGame.getState().toast === toast) useGame.setState({ toast: null })
    }, TOAST_MS)
    return () => clearTimeout(id)
  }, [toast])
  if (!toast || panelOpen) return null
  return (
    <div
      key={toast.id}
      className="pp-result pointer-events-none absolute left-1/2 top-[16%] z-30 flex flex-col items-center text-center"
      style={{ fontSize: u(56), animationDuration: `${TOAST_MS}ms`, width: 'max-content', maxWidth: '92vw' }}
    >
      <StrokeText stroke={u(12)} gradient={GRADIENTS.gold} style={{ whiteSpace: 'normal' }}>
        {toast.text}
      </StrokeText>
    </div>
  )
}

export default Toast
