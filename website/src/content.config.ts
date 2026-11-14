import { defineCollection } from 'astro:content';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { i18nLoader } from '@astrojs/starlight/loaders';
import { docsCollectionLoader } from '../docs.mjs';

export const collections = {
  docs: defineCollection({ loader: docsCollectionLoader(), schema: docsSchema() }),
  // The theme menu names the brand's themes, Day and Night.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
