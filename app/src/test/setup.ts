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

// Mock framer-motion. Any `motion.x` renders as a plain `x`, so a component
// test does not fail on whichever element the component happens to animate.
vi.mock('framer-motion', () => ({
  // Callable as well: `motion(Component)` hands the component back unchanged.
  motion: new Proxy(
    function motion() {},
    {
      get: (_target, tag: string) => tag,
      apply: (_target, _thisArg, [component]: [unknown]) => component,
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lucide-react icons. Every icon is a stub that renders nothing, rather
// than a list that has to be extended whenever a component picks a new one.
vi.mock('lucide-react', () => {
  const icon = () => null;
  // `then` has to stay undefined: a module namespace that answers it looks
  // like a promise, and `await import(...)` would never resolve.
  const reserved = new Set(['then', 'default', '__esModule']);
  return new Proxy(
    { __esModule: true } as Record<string, unknown>,
    {
      get: (target, name) => {
        if (typeof name !== 'string' || reserved.has(name)) {
          return target[name as string];
        }
        return icon;
      },
      // Vitest checks that a mock really exports what a module imports.
      has: () => true,
    }
  );
});

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
