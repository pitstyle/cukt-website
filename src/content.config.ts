import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const cukt = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cukt' }),
  schema: z.object({
    title: z.string(),
    type: z.string().optional(),
    number: z.coerce.number().optional(),
    date: z.string().optional(),
    location: z.string().optional(),
    authors: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    order: z.number().optional(),
  }),
});

const personal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/personal' }),
  schema: z.object({
    title: z.string(),
    date: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
    order: z.number().optional(),
  }),
});

const archiwistka = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/archiwistka' }),
  schema: z.object({
    title: z.string(),
    project: z.string().optional(),
    type: z.enum(['teczka', 'karta']),
    date: z.string(),
    status: z.string(),
  }),
});

export const collections = { cukt, personal, archiwistka };
