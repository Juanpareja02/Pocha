'use server';

/**
 * @fileOverview Determines the AI opponent's bet based on its hand.
 *
 * - aiOpponentBets - A function that determines the AI opponent's bet.
 * - AiOpponentBetsInput - The input type for the aiOpponentBets function.
 * - AiOpponentBetsOutput - The return type for the aiOpponentBets function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiOpponentBetsInputSchema = z.object({
  hand: z.array(z.string()).describe('The cards in the AI opponent\'s hand.'),
  round: z.number().describe('The current round number.'),
  trumpSuit: z.string().optional().describe('The trump suit for the round, if any.'),
  players: z.number().describe('The number of players in the game'),
});
export type AiOpponentBetsInput = z.infer<typeof AiOpponentBetsInputSchema>;

const AiOpponentBetsOutputSchema = z.object({
  bet: z.number().describe('The AI opponent\'s bet for the round.'),
});
export type AiOpponentBetsOutput = z.infer<typeof AiOpponentBetsOutputSchema>;

export async function aiOpponentBets(input: AiOpponentBetsInput): Promise<AiOpponentBetsOutput> {
  return aiOpponentBetsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentBetsPrompt',
  input: {schema: AiOpponentBetsInputSchema},
  output: {schema: AiOpponentBetsOutputSchema},
  prompt: `You are an AI that is playing a card game called La Pocha. You must determine how many tricks you will win this round. 

Here are the cards in your hand: {{hand}}

This is round number {{round}}.

There are {{players}} players in this game

{% if trumpSuit %}The trump suit is {{trumpSuit}}.{% endif %}

Consider the strength of your hand, the current round, the number of players, and the trump suit when determining your bet.

Return your bet as a number. The bet must be between 0 and the number of cards in your hand, inclusive.
`,
});

const aiOpponentBetsFlow = ai.defineFlow(
  {
    name: 'aiOpponentBetsFlow',
    inputSchema: AiOpponentBetsInputSchema,
    outputSchema: AiOpponentBetsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

