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
  hand: z.array(z.string()).describe('Las cartas en la mano del oponente de la IA.'),
  round: z.number().describe('El número de la ronda actual.'),
  trumpSuit: z.string().optional().describe('El palo de triunfo para la ronda, si lo hay.'),
  players: z.number().describe('El número de jugadores en el juego'),
});
export type AiOpponentBetsInput = z.infer<typeof AiOpponentBetsInputSchema>;

const AiOpponentBetsOutputSchema = z.object({
  bet: z.number().describe('La apuesta del oponente de la IA para la ronda.'),
});
export type AiOpponentBetsOutput = z.infer<typeof AiOpponentBetsOutputSchema>;

export async function aiOpponentBets(input: AiOpponentBetsInput): Promise<AiOpponentBetsOutput> {
  return aiOpponentBetsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentBetsPrompt',
  input: {schema: AiOpponentBetsInputSchema},
  output: {schema: AiOpponentBetsOutputSchema},
  prompt: `Eres una IA que está jugando un juego de cartas llamado La Pocha. Debes determinar cuántas bazas ganarás en esta ronda.

Estas son las cartas en tu mano: {{hand}}

Esta es la ronda número {{round}}.

Hay {{players}} jugadores en este juego.

{% if trumpSuit %}El palo de triunfo es {{trumpSuit}}.{% endif %}

Considera la fuerza de tu mano, la ronda actual, el número de jugadores y el palo de triunfo al determinar tu apuesta.

Devuelve tu apuesta como un número. La apuesta debe estar entre 0 y el número de cartas en tu mano, inclusive.
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
