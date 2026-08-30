export function brandFaviconSvg(accent: string, dark: boolean): string {
  const body = dark ? "#1a2326" : "#e7eef0";
  const plate = dark ? "#111416" : "#d5dfe3";
  const glow = accent || "#4fd8c4";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect width="32" height="32" rx="8" fill="${plate}"/>
<rect x="10.5" y="2.4" width="16" height="22" rx="3.2" fill="${glow}" fill-opacity="0.35"/>
<rect x="7.5" y="5" width="16" height="22" rx="3.2" fill="${glow}" fill-opacity="0.55"/>
<rect x="4.5" y="7.6" width="16" height="22" rx="3.2" fill="${body}"/>
<rect x="7.4" y="10.4" width="10.2" height="8" rx="1.6" fill="${glow}"/>
<rect x="7.4" y="20.2" width="10.2" height="2.1" rx="1" fill="${glow}"/>
<rect x="7.4" y="23.6" width="6.4" height="2.1" rx="1" fill="${glow}" fill-opacity="0.55"/>
</svg>`;
}
