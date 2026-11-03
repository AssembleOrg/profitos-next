import type { SVGProps } from "react";

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></Base>
);
export const IconHeart = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" /></Base>
);
export const IconPhone = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M6.6 3.5h2.6l1.5 4.2-2 1.5a12 12 0 0 0 6.1 6.1l1.5-2 4.2 1.5v2.6a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" /></Base>
);
export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>
);
export const IconMenu = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 7.5h16M4 16.5h16" /></Base>
);
export const IconFilters = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Base>
);
export const IconArrow = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>
);
export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Base>
);
export const IconPlay = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></Base>
);
export const IconGrid = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></Base>
);
export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Base strokeWidth="2.4" {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Base>
);
export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <Base strokeWidth="2" {...p}><path d="m7 9.5 5 5 5-5" /></Base>
);
export const IconWhatsapp = (p: SVGProps<SVGSVGElement>) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.15l-.3-.18-3 .8.8-2.95-.2-.3a8.2 8.2 0 1 1 6.9 3.78Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.22-.08-.39-.12-.55.13-.16.24-.63.8-.78.96-.14.16-.29.18-.53.06a6.7 6.7 0 0 1-3.3-2.88c-.25-.43.25-.4.71-1.33.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.43.06-.65.3-.22.25-.85.84-.85 2.04s.87 2.36 1 2.53c.12.16 1.72 2.62 4.16 3.68 1.55.67 2.15.73 2.92.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.11-.23-.17-.47-.3Z" />
  </svg>
);
