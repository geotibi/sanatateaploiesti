import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

export default defineConfig({
  // Mod hibrid: paginile publice sunt statice (SSG), iar rutele /admin/* rulează pe server (SSR)
  output: 'hybrid',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    tailwind({
      // Dezactivăm stilurile globale de bază ale Tailwind ca să nu intre în conflict cu AdminLTE/Bootstrap pe rutele de admin
      applyBaseStyles: false,
    }),
  ],
  server: {
    port: 4321,
    host: true,
  },
});
