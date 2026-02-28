import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    button: 'button',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Send: 'Send',
  Play: 'Play',
  Users: 'Users',
  Wallet: 'Wallet',
  MessageCircle: 'MessageCircle',
  Sparkles: 'Sparkles',
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string; fill?: boolean; className?: string }) => {
    return null;
  },
}));

// Global test timeout
vi.setConfig({
  testTimeout: 10000,
});
