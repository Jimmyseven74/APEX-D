// Icons exported from Figma (APEX DREAMS — Design System v01). Strokes use currentColor.
import type { ReactNode } from "react";

function Svg({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconClose = () => (
  <Svg>
    <path d="M6 6L18 18M18 6L6 18" />
  </Svg>
);
export const IconScan = () => (
  <Svg>
    <path d="M11 17C14.3137 17 17 14.3137 17 11C17 7.68629 14.3137 5 11 5C7.68629 5 5 7.68629 5 11C5 14.3137 7.68629 17 11 17Z" />
    <path d="M20 20L15.5 15.5" />
  </Svg>
);
export const IconCamera = () => (
  <Svg>
    <path d="M4 8H7L9 5H15L17 8H20V19H4V8Z" />
    <path d="M12 16.5C13.933 16.5 15.5 14.933 15.5 13C15.5 11.067 13.933 9.5 12 9.5C10.067 9.5 8.5 11.067 8.5 13C8.5 14.933 10.067 16.5 12 16.5Z" />
  </Svg>
);
export const IconPhotos = () => (
  <Svg>
    <path d="M12 15V4M17 9L12 4L7 9M5 20H19" />
  </Svg>
);
export const IconPdf = () => (
  <Svg>
    <path d="M18 7L14 3H7V21H18V7ZM14 3V7H18M10 12H15M10 16H15" />
  </Svg>
);
export const IconCalendar = () => (
  <Svg>
    <path d="M18 5H6C4.89543 5 4 5.89543 4 7V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V7C20 5.89543 19.1046 5 18 5Z" />
    <path d="M4 10H20M8 3V7M16 3V7" />
  </Svg>
);
export const IconDone = () => (
  <Svg>
    <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" />
    <path d="M8 12.5L10.5 15L16 9.5" />
  </Svg>
);
export const IconSnooze = () => (
  <Svg>
    <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" />
    <path d="M12 8V12L15 14" />
  </Svg>
);
export const IconTurnOff = () => (
  <Svg>
    <path d="M5 7H19M10 7V4H14V7M7 7L8 20H16L17 7" />
  </Svg>
);
export const IconBellOff = () => (
  <Svg size={28}>
    <path d="M11.6667 24.5H16.3333M7 18.6666V12.8333C7 10.9768 7.7375 9.19632 9.05025 7.88357C10.363 6.57081 12.1435 5.83331 14 5.83331C15.8565 5.83331 17.637 6.57081 18.9497 7.88357C20.2625 9.19632 21 10.9768 21 12.8333V18.6666L22.75 21H5.25L7 18.6666Z" />
  </Svg>
);
export const IconCheck = () => (
  <Svg size={16}>
    <path d="M3.33325 8.33317L6.33325 11.3332L12.6666 4.6665" />
  </Svg>
);
