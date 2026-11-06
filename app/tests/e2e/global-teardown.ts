import { rmSync } from 'fs';

/** Removes the throwaway embedded store the run played on. */
export default function globalTeardown() {
  const dataDir = process.env.E2E_PGLITE_DIR;
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}
