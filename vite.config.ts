import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths let the built site work at username.github.io/repository-name/
  // as well as on a custom domain.
  base: './',
});
