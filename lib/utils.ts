import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function generateUrl(shorthand: string) {
  return `${process.env.DOMAIN_URL}/${shorthand}`;
}
