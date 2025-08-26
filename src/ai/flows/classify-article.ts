'use server';
/**
 * @fileOverview Classifies articles based on inclusion and exclusion criteria using AI.
 *
 * - classifyArticle - A function that classifies an article based on criteria.
 * - ClassifyArticleInput - The input type for the classifyArticle function.
 * - ClassifyArticleOutput - The return type for the classifyArticle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ClassifyArticleInputSchema = z.object({
  title: z.string().describe('The title of the scientific article.'),
  abstract: z.string().describe('The abstract of the scientific article.'),
  inclusionCriteria: z
    .array(z.string())
    .describe('The inclusion criteria for classifying the article.'),
  exclusionCriteria: z
    .array(z.string())
    .describe('The exclusion criteria for classifying the article.'),
});
export type ClassifyArticleInput = z.infer<typeof ClassifyArticleInputSchema>;

const ClassifyArticleOutputSchema = z.object({
  include: z
    .boolean()
    .describe(
      'Whether the article meets the inclusion criteria and does not meet the exclusion criteria.'
    ),
  reason: z.string().describe('The reason for the classification.'),
});
export type ClassifyArticleOutput = z.infer<typeof ClassifyArticleOutputSchema>;

export async function classifyArticle(
  input: ClassifyArticleInput
): Promise<ClassifyArticleOutput> {
  return classifyArticleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'classifyArticlePrompt',
  input: {schema: ClassifyArticleInputSchema},
  output: {schema: ClassifyArticleOutputSchema},
  prompt: `You are an expert researcher classifying scientific articles based on inclusion and exclusion criteria.

  Analyze the title and abstract of the article and determine if it meets the inclusion criteria and does not meet the exclusion criteria. Return true for include if it meets the inclusion criteria and does not meet the exclusion criteria, and false otherwise.  Explain the reasoning for your classification.

  Title: {{{title}}}
  Abstract: {{{abstract}}}

  Inclusion Criteria:
  {{#each inclusionCriteria}}
  - {{{this}}}
  {{/each}}

  Exclusion Criteria:
  {{#each exclusionCriteria}}
  - {{{this}}}
  {{/each}}
  `,
});

const classifyArticleFlow = ai.defineFlow(
  {
    name: 'classifyArticleFlow',
    inputSchema: ClassifyArticleInputSchema,
    outputSchema: ClassifyArticleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
