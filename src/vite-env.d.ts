/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INCLUDE_FANTASY_PROPS_MEGAKIT_STANDARD?: string;
  readonly VITE_INCLUDE_MODULAR_SCIFI_MEGAKIT_STANDARD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
