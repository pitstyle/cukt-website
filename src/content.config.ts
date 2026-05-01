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


const podcasts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/podcasts' }),
  schema: z.object({
    title: z.string(),
    title_en: z.string().optional(),
    episode: z.number(),
    date: z.string(),
    structure: z.enum(['rashomon', 'nolan', 'kronika', 'sledztwo']).optional(),
    duration_pl: z.string().optional(),
    duration_en: z.string().optional(),
    audio_pl: z.string().optional(),
    audio_en: z.string().optional(),
    voices: z.array(z.string()).optional(),
    archive_refs: z.array(z.string()).optional(),
    connects_to: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    description: z.string().optional(),
    description_en: z.string().optional(),
  }),
});

export const collections = { cukt, personal, archiwistka, podcasts };
