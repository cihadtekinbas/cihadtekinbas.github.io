// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  site: 'https://cihadtekinbas.github.io',
  output: 'server',
  adapter: node({
    mode: 'middleware',
  }),
});
