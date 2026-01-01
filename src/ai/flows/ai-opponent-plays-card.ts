'use server';

/**
 * @fileOverview This file defines the AI opponent's card selection flow.
 *
 * It exports:
 * - `aiOpponentPlaysCard`: The main function to determine the AI's card play.
 * - `AiOpponentPlaysCardInput`: The input type for the `aiOpponentPlaysCard` function.
 * - `AiOpponentPlaysCardOutput`: The output type for the `aiOpponentPlaysCard` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CardSchema = z.object({
  suit: z.string(), // e.g., 'hearts', 'diamonds', 'clubs', 'spades'
  rank: z.string(), // e.g., '2', '3', '4', ..., '10', 'J', 'Q', 'K', 'A'
});
export type Card = z.infer<typeof CardSchema>;

const AiOpponentPlaysCardInputSchema = z.object({
  hand: z.array(CardSchema).describe('The cards currently in the AI opponent hand.'),
  playedCards: z.array(CardSchema).describe('The cards that have already been played in the current trick.'),
  trumpSuit: z.string().describe('The trump suit for the current round.'),
  leadingSuit: z.string().optional().describe('The suit of the first card played in the current trick, if any.'),
  currentScore: z.number().describe('Current score of the AI opponent'),
  predictedTricks: z.number().describe('The number of tricks the AI opponent predicted it would win'),
  roundNumber: z.number().describe('The current round number'),
});

export type AiOpponentPlaysCardInput = z.infer<typeof AiOpponentPlaysCardInputSchema>;

const AiOpponentPlaysCardOutputSchema = z.object({
  cardToPlay: CardSchema.describe('The card the AI opponent has decided to play.'),
  reasoning: z.string().describe('The AI reasoning for choosing the card.')
});

export type AiOpponentPlaysCardOutput = z.infer<typeof AiOpponentPlaysCardOutputSchema>;


export async function aiOpponentPlaysCard(input: AiOpponentPlaysCardInput): Promise<AiOpponentPlaysCardOutput> {
  return aiOpponentPlaysCardFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentPlaysCardPrompt',
  input: {schema: AiOpponentPlaysCardInputSchema},
  output: {schema: AiOpponentPlaysCardOutputSchema},
  prompt: `You are an AI opponent in a card game called La Pocha. Your goal is to play your cards strategically to win the number of tricks you predicted at the start of the round.

You are playing a card in the current trick.  Here's the current situation:

Your hand: {{#each hand}}{{{suit}}} {{{rank}}}{{#unless @last}}, {{/unless}}{{/each}}
Played cards in this trick: {{#each playedCards}}{{{suit}}} {{{rank}}}{{#unless @last}}, {{/unless}}{{/each}}
Trump suit: {{{trumpSuit}}}
Leading suit (if any): {{{leadingSuit}}}
Your current score: {{{currentScore}}}
Number of tricks you predicted you would win: {{{predictedTricks}}}
Current round number: {{{roundNumber}}}

Based on this information, choose one card from your hand to play. Explain your reasoning for choosing this card, considering the game rules, the current trick, and your overall strategy to achieve your predicted number of tricks.

Ensure that if you can follow the leading suit you MUST do so, but beyond that make the best decision you can.

Output the card you choose and your reasoning, following the schema.
`,
});

const aiOpponentPlaysCardFlow = ai.defineFlow(
  {
    name: 'aiOpponentPlaysCardFlow',
    inputSchema: AiOpponentPlaysCardInputSchema,
    outputSchema: AiOpponentPlaysCardOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
