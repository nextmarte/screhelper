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
  model: z
    .string()
    .optional()
    .describe('The Gemini model to use for classification.'),
});
export type ClassifyArticleInput = z.infer<typeof ClassifyArticleInputSchema>;

const ClassifyArticleOutputSchema = z.object({
  include: z
    .boolean()
    .describe(
      'Whether the article meets the inclusion criteria and does not meet the exclusion criteria.'
    ),
  reason: z
    .string()
    .describe('The reason for the classification, written in English.'),
  criterion: z
    .string()
    .describe(
      'The single, most relevant inclusion or exclusion criterion that justifies the classification.'
    ),
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

  Analyze the title and abstract of the article and determine if it meets the inclusion criteria and does not meet the exclusion criteria.

  - Your response must be in English.
  - Set 'include' to true if it meets all inclusion criteria and no exclusion criteria. Otherwise, set it to false.
  - Provide a brief 'reason' for your decision.
  - Identify the single, most relevant 'criterion' from the provided lists that is the primary reason for your classification.

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
    if (!output) {
      throw new Error('The model did not return a valid classification.');
    }
    return output;
  }
);
