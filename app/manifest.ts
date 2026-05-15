import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Warmind',
    short_name: 'Warmind',
    description: 'A minimalist Destiny 2 companion app for gear, vault, and clan management.',
    start_url: '/',
    id: '/',
    scope: '/',
    lang: 'en',
    dir: 'ltr',
    display: 'standalone',
    background_color: '#020617', // slate-950
    theme_color: '#e3ce62', // destiny-gold
    orientation: 'landscape-primary',
    categories: ['entertainment', 'utilities', 'games'],
    icons: [
      {
        src: '/icon-256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-mobile.png',
        sizes: '1170x1940',
        type: 'image/png',
        label: 'Manage your inventory on the go',
        form_factor: 'narrow',
      },
      {
        src: '/screenshot-desktop.png',
        sizes: '1930x1080',
        type: 'image/png',
        label: 'Comprehensive vault management',
        form_factor: 'wide',
      },
    ],
    shortcuts: [
      {
        name: 'Vault',
        short_name: 'Vault',
        description: 'Access your vault',
        url: '/character/vault',
        icons: [{ src: '/icons/vault.png', sizes: '192x192' }],
      },
      {
        name: 'Inventory',
        short_name: 'Inventory',
        description: 'Manage current character inventory',
        url: '/character/inventory',
        icons: [{ src: '/icons/inventory.png', sizes: '192x192' }],
      },
    ],
  };
}
