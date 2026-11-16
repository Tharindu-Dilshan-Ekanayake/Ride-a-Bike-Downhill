import { useGame } from '../../store/game'
import RideOverlay from '../ride/RideOverlay'
import RideResults from '../ride/RideResults'
import InteractPrompt from './InteractPrompt'
import LeftMenu from './LeftMenu'
import PassButtons from './PassButtons'
import PlayPanel from './PlayPanel'
import StatsPanel from './StatsPanel'
import Toast from './Toast'
import TopBar from './TopBar'
import TopCenter from './TopCenter'

/**
 * The heads-up display: Rebirths and Coins top-left over the menu tiles, the Coin passes
 * on the right, the tutorial / next goal top-centre, sound, daily rewards, leaderboards
 * and your name tag top-right, and the PLAY button with the Bikes / Boost / Income cards
 * bottom-centre.
 *
 * The root ignores pointer events so the canvas and joystick underneath keep working;
 * only the buttons themselves opt back in. While a panel is open the lobby HUD steps
 * aside; while you ride it's hidden altogether and the ride's own HUD (RideOverlay) and
 * results (RideResults) take over - those two decide for themselves when to show.
 */
export function HUD() {
  const panelOpen = useGame((s) => s.panel !== null)
  const riding = useGame((s) => s.ride !== null)
  return (
    <div className="pp-font pointer-events-none absolute inset-0 z-20 select-none">
      {/* Hidden, not unmounted, while riding: remounting at the moment you come back
          from a ride cost a visible hitch on slow phones, and display: none takes them
          out of style and layout altogether. */}
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{ opacity: panelOpen ? 0 : 1, visibility: panelOpen ? 'hidden' : 'visible', display: riding ? 'none' : 'block' }}
      >
        <TopBar />
        <StatsPanel />
        <LeftMenu />
        <PassButtons />
        <TopCenter />
        <PlayPanel />
        <InteractPrompt />
      </div>
      <RideOverlay />
      <RideResults />
      <Toast />
    </div>
  )
}

export default HUD
