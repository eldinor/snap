/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INCLUDE_FANTASY_PROPS_MEGAKIT_STANDARD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
