import { createAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0b6bcb' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0b6bcb' } },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.4,
        resizeOptions: { background: '#f4f5f7', fit: 'contain' },
        darkResizeOptions: { background: '#0d0f12', fit: 'contain' },
        linkMediaOptions: { log: false, addMediaScreen: true, xhtml: false },
        png: { compressionLevel: 9, quality: 60 },
        name: (landscape, size, dark) => `apple-splash-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark-' : ''}${size.width}x${size.height}.png`,
      },
      [
        'iPhone SE 4.7"', 'iPhone XR', 'iPhone X', 'iPhone 11 Pro Max', 'iPhone 12 mini', 'iPhone 12', 'iPhone 12 Pro Max',
        'iPhone 13 mini', 'iPhone 13', 'iPhone 13 Pro Max', 'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
        'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
        'iPhone 16e', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
      ],
    ),
  },
  images: ['public/logo.svg'],
});
