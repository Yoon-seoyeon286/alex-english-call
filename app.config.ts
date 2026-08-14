import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Alex — personal AI English calling app.
 *
 * NOTE: no OpenAI credentials live here or anywhere in the app bundle.
 * The app only knows the URL of its own backend plus a rotate-able app token.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Alex',
  slug: 'alex-english-call',
  scheme: 'alexcall',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  backgroundColor: '#08090C',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.gayeon.alexcall',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#08090C',
    },
    permissions: [
      'android.permission.INTERNET',
      'android.permission.RECORD_AUDIO',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.WAKE_LOCK',
      'android.permission.BLUETOOTH_CONNECT',
    ],
  },
  ios: {
    bundleIdentifier: 'com.gayeon.alexcall',
    supportsTablet: false,
    infoPlist: {
      NSMicrophoneUsageDescription:
        'Alex needs your microphone so you can talk with him in English.',
    },
  },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-dev-client',
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission: false,
        microphonePermission:
          'Alex needs your microphone so you can talk with him in English.',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#08090C',
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      // Filled in automatically by `eas init`.
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
