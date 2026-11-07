import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
class DM { m22 = 1; }
(globalThis as unknown as { DOMMatrixReadOnly: typeof DM }).DOMMatrixReadOnly = DM;
if (!File.prototype.text) File.prototype.text = function (this: File) {
  return new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(this); });
};
afterEach(() => cleanup());
