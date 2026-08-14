/// <reference types="nativewind/types" />

// Tailwind's entry stylesheet is consumed by the Metro/NativeWind transform,
// so TypeScript only needs to know the side-effect import is legal.
declare module '*.css';
