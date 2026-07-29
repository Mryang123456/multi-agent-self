// 测试全局 setup:
// 1) 注册 jest-dom 断言(toBeInTheDocument 等)。
// 2) 每测例后清理渲染(vitest globals 关闭时 RTL 不自动 cleanup,手动接 afterEach)。
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
