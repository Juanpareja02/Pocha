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
  hand: z.array(CardSchema).describe('Las cartas actualmente en la mano del oponente de la IA.'),
  playedCards: z.array(CardSchema).describe('Las cartas que ya se han jugado en la baza actual.'),
  trumpSuit: z.string().describe('El palo de triunfo para la ronda actual.'),
  leadingSuit: z.string().optional().describe('El palo de la primera carta jugada en la baza actual, si la hay.'),
  currentScore: z.number().describe('Puntuación actual del oponente de la IA.'),
  predictedTricks: z.number().describe('El número de bazas que el oponente de la IA predijo que ganaría.'),
  roundNumber: z.number().describe('El número de la ronda actual.'),
});

export type AiOpponentPlaysCardInput = z.infer<typeof AiOpponentPlaysCardInputSchema>;

const AiOpponentPlaysCardOutputSchema = z.object({
  cardToPlay: CardSchema.describe('La carta que el oponente de la IA ha decidido jugar.'),
  reasoning: z.string().describe('El razonamiento de la IA para elegir la carta.')
});

export type AiOpponentPlaysCardOutput = z.infer<typeof AiOpponentPlaysCardOutputSchema>;


export async function aiOpponentPlaysCard(input: AiOpponentPlaysCardInput): Promise<AiOpponentPlaysCardOutput> {
  return aiOpponentPlaysCardFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiOpponentPlaysCardPrompt',
  input: {schema: AiOpponentPlaysCardInputSchema},
  output: {schema: AiOpponentPlaysCardOutputSchema},
  prompt: `Eres un oponente de IA en un juego de cartas llamado La Pocha. Tu objetivo es jugar tus cartas estratégicamente para ganar el número de bazas que predijiste al comienzo de la ronda.

Estás jugando una carta en la baza actual. Aquí está la situación actual:

Tu mano: {{#each hand}}{{{suit}}} {{{rank}}}{{#unless @last}}, {{/unless}}{{/each}}
Cartas jugadas en esta baza: {{#each playedCards}}{{{suit}}} {{{rank}}}{{#unless @last}}, {{/unless}}{{/each}}
Palo de triunfo: {{{trumpSuit}}}
Palo de salida (si lo hay): {{{leadingSuit}}}
Tu puntuación actual: {{{currentScore}}}
Número de bazas que predijiste que ganarías: {{{predictedTricks}}}
Número de ronda actual: {{{roundNumber}}}

Basado en esta información, elige una carta de tu mano para jugar. Explica tu razonamiento para elegir esta carta, considerando las reglas del juego, la baza actual y tu estrategia general para lograr el número de bazas predicho.

Asegúrate de que si puedes seguir el palo de salida DEBES hacerlo, pero más allá de eso, toma la mejor decisión que puedas.

Devuelve la carta que elijas y tu razonamiento, siguiendo el esquema.
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
