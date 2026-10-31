import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { audio } from './audio/audio';
import BackgroundFX from './components/BackgroundFX';
import GameScreen from './components/GameScreen';
import SetupScreen from './components/SetupScreen';
import StartScreen, { type MenuModal } from './components/StartScreen';
import { HelpModal, HighScoresModal, SettingsModal } from './components/Overlays';
import BottomNav, { NAV_H, type Tab } from './components/BottomNav';
import ActivityTab from './components/ActivityTab';
import LeaderboardTab from './components/LeaderboardTab';
import ProfileTab from './components/ProfileTab';
import ShopModal from './components/ShopModal';
import { equippedTheme } from './economy/cosmetics';
import { useStore } from './economy/store';
import type { GameOptions, Settings } from './game/types';
import { themeVars } from './themes';
import { loadSettings, saveSettings } from './storage';
import { quickOptions } from './setup';

type Screen = 'menu' | 'setup' | 'game';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameOpts, setGameOpts] = useState<GameOptions | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [modal, setModal] = useState<MenuModal | null>(null);
  const [tab, setTab] = useState<Tab>('play');
  const { eco } = useStore();
  const { ui, token, dice, board } = eco.equipped;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const theme = useMemo(() => equippedTheme(eco), [ui, token, dice, board]);

  const update = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);

  useEffect(() => saveSettings(settings), [settings]);
  useEffect(() => audio.setMusicOn(settings.music), [settings.music]);
  useEffect(() => audio.setSfxOn(settings.sfx), [settings.sfx]);
  useEffect(() => audio.setVolumes(settings.musicVolume, settings.sfxVolume), [settings.musicVolume, settings.sfxVolume]);
  useEffect(() => {
    audio.setStyle(theme.music);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.dark ? '#0f172a' : '#ffffff');
  }, [theme]);

  useEffect(() => {
    audio.startMusic();
    const unlock = () => audio.unlock();
    const evts = ['pointerdown', 'touchend', 'click', 'keydown'] as const;
    evts.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => evts.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  const startGame = useCallback((o: GameOptions) => {
    setGameOpts(o);
    setGameKey((k) => k + 1);
    setScreen('game');
    setModal(null);
  }, []);
  const quick = useCallback(() => startGame(quickOptions(settings)), [settings, startGame]);
  const restart = useCallback(() => {
    setGameKey((k) => k + 1);
    setModal(null);
  }, []);
  const exit = useCallback(() => {
    setScreen('menu');
    setModal(null);
  }, []);
  const openScores = useCallback(() => setModal('scores'), []);
  const closeModal = useCallback(() => setModal(null), []);

  const navVisible = !(tab === 'play' && screen === 'game');

  return (
    <div
      className={`app-bg font-game fixed inset-0 overflow-hidden ${theme.animatedBg ? 'animated' : ''}`}
      style={themeVars(theme) as CSSProperties}
    >
      <BackgroundFX theme={theme} />
      <div className="absolute inset-x-0 top-0" style={{ bottom: navVisible ? `calc(${NAV_H}px + env(safe-area-inset-bottom))` : 0 }}>
      {tab === 'play' && screen === 'menu' && (
        <StartScreen
          theme={theme}
          settings={settings}
          update={update}
          onQuick={quick}
          onSetup={() => setScreen('setup')}
          onModal={setModal}
          modalOpen={modal !== null}
        />
      )}
      {tab === 'play' && screen === 'setup' && (
        <SetupScreen theme={theme} settings={settings} update={update} onBack={() => setScreen('menu')} onStart={startGame} />
      )}
      {tab === 'play' && screen === 'game' && gameOpts && (
        <GameScreen
          key={gameKey}
          options={gameOpts}
          theme={theme}
          settings={settings}
          update={update}
          onExit={exit}
          onRestart={restart}
          onScores={openScores}
          modalOpen={modal !== null}
        />
      )}
      {tab === 'activity' && <ActivityTab />}
      {tab === 'leaderboard' && <LeaderboardTab />}
      {tab === 'profile' && <ProfileTab onShop={() => setModal('shop')} onSettings={() => setModal('settings')} onHelp={() => setModal('help')} />}
      </div>
      {navVisible && <BottomNav tab={tab} onTab={setTab} />}
      {(modal === 'themes' || modal === 'shop') && <ShopModal initial={modal === 'themes' ? 'ui' : 'token'} onClose={closeModal} />}
      {modal === 'scores' && <HighScoresModal theme={theme} onClose={closeModal} />}
      {modal === 'help' && <HelpModal onClose={closeModal} />}
      {modal === 'settings' && <SettingsModal settings={settings} update={update} onClose={closeModal} />}
    </div>
  );
}
