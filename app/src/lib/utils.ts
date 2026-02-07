import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a random ID with optional prefix
 * Uses substring instead of deprecated substr
 */
export function generateId(prefix?: string): string {
  const randomPart = Math.random().toString(36).substring(2, 11)
  return prefix ? `${prefix}_${randomPart}` : randomPart
}

/**
 * Generate a user ID in the format user_xxxxxxxx
 */
export function generateUserId(): string {
  return generateId('user')
}

/**
 * Generate a player ID
 */
export function generatePlayerId(): string {
  return generateId('player')
}

/**
 * Generate a message ID
 */
export function generateMessageId(): string {
  return generateId('msg')
}

/**
 * Generate a match ID
 */
export function generateMatchId(): string {
  return generateId('match')
}
