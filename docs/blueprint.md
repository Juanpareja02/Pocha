# **App Name**: La Pocha

## Core Features:

- Anonymous/Google Authentication: Allows users to sign in either anonymously or using their Google account for persistent profiles and game history.
- Real-time Game Lobby: A lobby system where players can join a game using a short access code. The creator of the lobby has the ability to start the game when all players are ready.
- Betting Phase UI: Presents the player's hand and a UI element for betting the number of tricks they expect to win.
- Real-time Card Play: Allows players to play cards by dragging or clicking. Implements validation to ensure players follow suit if possible.
- Round and Game Status Management: Handles game progression, round increments (starting with one card and increasing to a maximum), trump suit selection and scoring, managing game states (LOBBY, BETTING, PLAYING, SCORING), and calculating scores at the end of each round and game.
- Turn Management and Trick Resolution: Keeps track of turn order, determines the winner of each trick based on card values and trump suit, and awards the trick to the winning player, updates the tricksWon value for each player.
- AI Opponent: Allows players to play with one or more AI opponents. An AI tool determines their bets and card selections based on the cards they are holding and the cards which have been played.

## Style Guidelines:

- Primary color: Deep Purple (#673AB7), providing a sophisticated and modern feel.
- Background color: Light Gray (#EEEEEE), for a clean, uncluttered interface.
- Accent color: Vibrant Cyan (#00BCD4), to highlight interactive elements and calls to action.
- Body and headline font: 'Inter' sans-serif, to create a clean and modern look for all text elements.
- Use clear and recognizable icons from Material Design (MUI) to represent game actions and information.
- Design a responsive layout optimized for mobile devices, ensuring all game elements are easily accessible on smaller screens.
- Incorporate subtle animations for card dealing, playing, and trick resolution to provide visual feedback and enhance user engagement.