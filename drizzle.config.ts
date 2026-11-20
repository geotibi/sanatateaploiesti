import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/core/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./data/arhiva-sanatatea.db',
  },
  verbose: true,
  strict: true,
});
