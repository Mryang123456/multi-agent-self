/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 生产环境后端基址;本地开发留空走 Vite proxy(/api → :3000)。 */
  readonly VITE_API_BASE?: string;
}
