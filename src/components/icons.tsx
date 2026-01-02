
import type { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2C9.486 2 4 9.486 4 12c0 2.514 1.486 4 4 4 .793 0 1.512-.21 2.14-.558C10.793 17.79 10 20.225 10 22h4c0-1.775-.793-4.21-1.86-6.558.628.348 1.347.558 2.14.558 2.514 0 4-1.486 4-4C20 9.486 14.514 2 12 2z" />
    <path d="M12 2c2.514 0 8 7.486 8 10 0 2.514-1.486 4-4 4-.793 0-1.512-.21-2.14-.558C13.207 17.79 14 20.225 14 22h-4c0-1.775.793-4.21 1.86-6.558-.628.348-1.347-.558-2.14-.558-2.514 0-4-1.486-4-4C4 9.486 9.486 2 12 2z" />
  </svg>
);


// Spanish Deck Icons
export const Oros = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12" r="5" />
  </svg>
);

export const Copas = (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 512 512" fill="currentColor" {...props}>
        <path d="M256 512c-32-44.8-128-155.2-128-256 0-88 96-128 128-128s128 40 128 128c0 100.8-96 211.2-128 256z" />
    </svg>
);

export const Espadas = (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 512 512" fill="currentColor" {...props}>
        <path d="M256 512c43.2-60.8 128-158.4 128-256 0-97.6-86.4-128-128-128S128 58.4 128 156c0 97.6 84.8 195.2 128 256zM256 240c-22.4 0-46.4 11.2-64 27.2-16-20.8-32-49.6-32-75.2 0-40 32-56 64-56s64 16 64 56c0 25.6-16 54.4-32 75.2-17.6-16-41.6-27.2-64-27.2z" />
    </svg>
);

export const Bastos = (props: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 512 512" fill="currentColor" {...props}>
        <path d="M384 336c52.8 0 96-43.2 96-96s-43.2-96-96-96-96 43.2-96 96 43.2 96 96 96zM128 336c52.8 0 96-43.2 96-96s-43.2-96-96-96-96 43.2-96 96 43.2 96 96 96zM256 224c52.8 0 96-43.2 96-96s-43.2-96-96-96-96 43.2-96 96 43.2 96 96 96zM280 352h-48c-8.8 0-16 7.2-16 16v128h80V368c0-8.8-7.2-16-16-16z" />
    </svg>
);
