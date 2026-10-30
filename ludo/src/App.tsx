import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { audio } from './audio/audio';
import BackgroundFX from './components/BackgroundFX';
import GameScreen from './components/GameScreen';
import SetupScreen from './components/SetupScreen';
import StartScreen, { type MenuModal } from './components/StartScreen';
import { HelpModal, HighScoresModal, SettingsModal, ThemesModal } from './components/Overlays';
import type { GameOptions, Settings } from './game/types';
import { getTheme, themeVars } from './themes';
import { loadSettings, saveSettings } from './storage';
import { quickOptions } from './setup';

type Screen = 'menu' | 'setup' | 'game';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameOpts, setGameOpts] = useState<GameOptions | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [modal, setModal] = useState<MenuModal | null>(null);
  const theme = useMemo(() => getTheme(settings.theme), [settings.theme]);

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

  return (
    <div
      className={`app-bg font-game fixed inset-0 overflow-hidden ${theme.animatedBg ? 'animated' : ''}`}
      style={themeVars(theme) as CSSProperties}
    >
      <BackgroundFX theme={theme} />
      {screen === 'menu' && (
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
      {screen === 'setup' && (
        <SetupScreen theme={theme} settings={settings} update={update} onBack={() => setScreen('menu')} onStart={startGame} />
      )}
      {screen === 'game' && gameOpts && (
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
      {modal === 'themes' && <ThemesModal value={settings.theme} onPick={(id) => update({ theme: id })} onClose={closeModal} />}
      {modal === 'scores' && <HighScoresModal theme={theme} onClose={closeModal} />}
      {modal === 'help' && <HelpModal onClose={closeModal} />}
      {modal === 'settings' && <SettingsModal settings={settings} update={update} onClose={closeModal} />}
    </div>
  );
}
