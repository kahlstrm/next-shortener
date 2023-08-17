import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function generateUrl(shorthand: string) {
  return `${process.env.VERCEL_URL}/${shorthand}`;
}
