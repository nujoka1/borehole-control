import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nujoka.kahalla.borehole',
  appName: 'Smart Water Tank',
  webDir: 'dist',
  server: { androidScheme: 'https' },
}

export default config
