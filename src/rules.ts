import { ComponentProp, ParsedComponent } from './types.js';

// Single source of truth for design system governance rules.
// Used by both checkUsage.ts (MCP tool) and rulesGenerator.ts (CLI file
// writer) so the forbidden-pattern definitions never drift apart between
// the two surfaces.

export const GLOBAL_RULES = {
  coreRule: 'className is for layout only (margin, position, flex/grid). Never for appearance.',
  safeClassName: [
    'm-*',
    'mt-*',
    'mr-*',
    'mb-*',
    'ml-*',
    'mx-*',
    'my-*',
    'w-full',
    'flex-1',
    'col-span-*',
  ],
  forbiddenClassName: [
    'bg-*',
    'text-*',
    'border-*',
    'p-*',
    'px-*',
    'py-*',
    'rounded-*',
    'shadow-*',
    'font-*',
  ],
  principle:
    'Before writing any UI, check dskit_list_components. If the component exists, use it. Never rebuild what the design system already provides.',
  importPath: "import { ComponentName } from '@company/ui'",
};

export const APPEARANCE_KEYWORDS = [
  'variant',
  'color',
  'tone',
  'size',
  'appearance',
  'intent',
  'theme',
  'level',
  'kind',
];

export const STATE_KEYWORDS = [
  'disabled',
  'loading',
  'error',
  'success',
  'checked',
  'selected',
  'active',
  'readonly',
  'required',
];

export function findAppearanceProp(props: ComponentProp[]): ComponentProp | undefined {
  return props.find((p) => APPEARANCE_KEYWORDS.some((k) => p.name.toLowerCase().includes(k)));
}

export function findStateProps(props: ComponentProp[]): ComponentProp[] {
  return props.filter((p) => STATE_KEYWORDS.includes(p.name.toLowerCase()));
}

export function findSizeProp(props: ComponentProp[]): ComponentProp | undefined {
  return props.find((p) => p.name.toLowerCase() === 'size');
}

// className token patterns that violate the sealed visual contract, plus
// the rule name and fix message shown alongside each violation. Checked
// against a tag's raw attribute string by dskit_check_usage.
export const FORBIDDEN_CLASSNAME_PATTERNS: { pattern: RegExp; rule: string; fix: string }[] = [
  {
    pattern: /\bbg-\w[\w/-]*/,
    rule: 'className color override',
    fix: 'Use variant/color prop instead',
  },
  { pattern: /\bp-\d+\b/, rule: 'className padding override', fix: 'Use size prop instead' },
  { pattern: /\bpx-\d+\b/, rule: 'className padding override', fix: 'Use size prop instead' },
  { pattern: /\bpy-\d+\b/, rule: 'className padding override', fix: 'Use size prop instead' },
  {
    pattern: /\btext-(?!left|right|center|justify)\w[\w/-]*/,
    rule: 'className typography override',
    fix: 'Use variant prop for color, size prop for size',
  },
  {
    pattern: /\bfont-\w[\w/-]*/,
    rule: 'className typography override',
    fix: 'Typography is sealed in design system components',
  },
  {
    pattern: /\brounded-\w[\w/-]*/,
    rule: 'className border override',
    fix: 'Border radius is sealed',
  },
];

export const STYLE_PATTERN = /style=\{\{[^}]*\}\}/;

// Token-level classifier used to strip forbidden classes out of a
// className value when building a corrected-code suggestion.
export function isForbiddenClassToken(token: string): boolean {
  return (
    /^bg-/.test(token) ||
    /^p-\d/.test(token) ||
    /^p[xytrbl]-\d/.test(token) ||
    (/^text-/.test(token) && !/^text-(left|right|center|justify)$/.test(token)) ||
    /^font-/.test(token) ||
    /^rounded-/.test(token) ||
    /^shadow-/.test(token) ||
    /^leading-/.test(token) ||
    /^tracking-/.test(token) ||
    /^border(-\w+)?$/.test(token)
  );
}

// Per-component FORBIDDEN bullet lines, shared by RULES.md generation and
// the MCP get_component tool's `rules.forbidden` array.
export function buildForbiddenBullets(componentName: string): string[] {
  return [
    `<${componentName} className='bg-*'> — use variant/color prop instead`,
    `<${componentName} className='p-*'> — padding is sealed, use size prop`,
    `<${componentName} className='text-* font-*'> — typography is sealed`,
    `<${componentName} className='rounded-* border-*'> — sealed`,
    `<${componentName} style={{...}}> — no inline style overrides`,
  ];
}

// Full per-component rules object returned by the MCP dskit_get_component tool.
export function buildComponentRules(component: ParsedComponent) {
  const appearance = findAppearanceProp(component.props);
  const sample = appearance?.options?.[0] || appearance?.name;

  return {
    classNameAllowed: ['margin', 'positioning'],
    classNameForbidden: ['colors', 'padding', 'typography', 'border'],
    forbidden: buildForbiddenBullets(component.name),
    compositionExample: appearance
      ? `<div className='flex gap-2'><${component.name} ${appearance.name}='${sample}'>Cancel</${component.name}><${component.name} ${appearance.name}='${appearance.options?.[1] ?? sample}'>Save</${component.name}></div>`
      : `<div className='flex gap-2'><${component.name}>Cancel</${component.name}><${component.name}>Save</${component.name}></div>`,
  };
}
