import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ludoparty.game',
  appName: 'Ludo Party',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  android: { allowMixedContent: false },
};

export default config;
