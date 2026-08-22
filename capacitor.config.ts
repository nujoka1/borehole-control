import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nujoka.kahalla.borehole',
  appName: 'Kahalla Borehole Control',
  webDir: 'dist',
  server: { androidScheme: 'https' },
}

export default config
