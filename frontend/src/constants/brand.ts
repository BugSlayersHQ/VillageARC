/**
 * Brand constants and global site configuration for Pralekh platform.
 */

export const BRAND = {
  name: 'Pralekh',
  hindiName: 'प्रलेख',
  tagline: 'Turn legacy land records into trusted digital data.',
  eyebrow: 'Digital infrastructure for land records',
  versionBadge: 'Pralekh OCR & Validation Pipeline →',
  shortDescription: 'Modernising the way land records are digitised, verified, and trusted.',
  fullDescription:
    'Pralekh uses document intelligence to digitise scanned land records, extract structured data, and cross-verify records with cadastral databases.',
  valueProposition:
    'From paper archives to a reliable digital land layer. Ingest documents, parse complex layouts, extract entities, validate with revenue databases, and deliver trusted records.',
  copyright: (year: number = new Date().getFullYear()) => `© ${year} Pralekh. All rights reserved.`,
} as const;

export interface NavFeatureItem {
  title: string;
  description: string;
  href: string;
  badge?: string;
  icon: 'scan' | 'extract' | 'validate' | 'structure';
}

export const NAV_FEATURES: NavFeatureItem[] = [
  {
    title: 'Document Digitization',
    description: 'Ingest and enhance degraded land registers, PDFs, and maps.',
    href: '#workflow',
    badge: 'AI OCR',
    icon: 'scan',
  },
  {
    title: 'Entity & Field Extraction',
    description: 'Extract Khasra, Khata, owners, and area coordinates automatically.',
    href: '#workflow',
    badge: '99% Acc.',
    icon: 'extract',
  },
  {
    title: 'Cadastral Cross-Validation',
    description: 'Cross-reference with state revenue databases & cadastral boundaries.',
    href: '#workflow',
    badge: 'Real-time',
    icon: 'validate',
  },
  {
    title: 'Digital Land Ledger',
    description: 'Structured, tamper-audited digital records ready for APIs & GIS.',
    href: '#workflow',
    icon: 'structure',
  },
];

export const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'How it works', href: '#workflow' },
  { label: 'Contact', href: '#contact' },
] as const;

export const AUTH_ROUTES = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  afterSignIn: '/',
  afterSignUp: '/',
} as const;
