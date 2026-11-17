import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mesaidefteri.app',
  appName: 'Mesai Defteri',
  webDir: 'dist',
  backgroundColor: '#0b0b0c',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#0b0b0c',
  },
};

export default config;
