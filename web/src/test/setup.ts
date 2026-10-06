import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

vi.setConfig({ testTimeout: 30000 });

afterEach(() => {
  cleanup();
});
