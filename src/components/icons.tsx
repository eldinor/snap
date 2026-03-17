import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function SnapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6.5h12" />
      <path d="M4 10h12" />
      <path d="M4 13.5h12" />
      <path d="M6.5 4v12" />
      <path d="M10 4v12" />
      <path d="M13.5 4v12" />
      <circle cx="10" cy="10" r="2.2" />
    </IconBase>
  );
}

export function SelectIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 3.5 15 10l-4.4 1 1.7 5-1.9.7-1.8-5L5 15.2V3.5Z" />
    </IconBase>
  );
}

export function PlaceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.5" y="7.5" width="11" height="8" rx="1.5" />
      <path d="M10 4v7" />
      <path d="m7.5 6.5 2.5-2.5 2.5 2.5" />
    </IconBase>
  );
}

export function UndoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 6 3.5 9.5 7 13" />
      <path d="M4 9.5h6.5a5 5 0 1 1 0 10H9" />
    </IconBase>
  );
}

export function RedoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m13 6 3.5 3.5L13 13" />
      <path d="M16 9.5H9.5a5 5 0 1 0 0 10H11" />
    </IconBase>
  );
}

export function ExportIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 3.5v8" />
      <path d="m6.8 8.2 3.2 3.3 3.2-3.3" />
      <path d="M4.5 12.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </IconBase>
  );
}

export function SaveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 4.5h8l2 2v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" />
      <path d="M7 4.8v4h5v-4" />
      <path d="M8 13.2h4" />
    </IconBase>
  );
}

export function ImportIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 11.5v-8" />
      <path d="m6.8 6.8 3.2-3.3 3.2 3.3" />
      <path d="M4.5 12.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </IconBase>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.5 6h9" />
      <path d="M8 6V4.5h4V6" />
      <path d="m6.5 6 .7 9a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.7-9" />
      <path d="M8.5 8.5v5" />
      <path d="M11.5 8.5v5" />
    </IconBase>
  );
}

export function ClearIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 14.5h11" />
      <path d="m6.2 12.8 7.6-7.6" />
      <path d="m6.8 6.2 7 7" />
    </IconBase>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="10" r="2.4" />
      <path d="M10 3.5v2" />
      <path d="M10 14.5v2" />
      <path d="m14.6 5.4-1.4 1.4" />
      <path d="m6.8 13.2-1.4 1.4" />
      <path d="M16.5 10h-2" />
      <path d="M5.5 10h-2" />
      <path d="m14.6 14.6-1.4-1.4" />
      <path d="m6.8 6.8-1.4-1.4" />
    </IconBase>
  );
}

export function SaveLoadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" opacity="0.35" />
      <path d="M5.5 6.5H12" />
      <path d="m10 4.2 2.3 2.3L10 8.8" />
      <path d="M14.5 13.5H8" />
      <path d="m10 11.2-2.3 2.3 2.3 2.3" />
    </IconBase>
  );
}
