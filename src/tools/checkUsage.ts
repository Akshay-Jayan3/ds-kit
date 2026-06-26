import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ParsedComponent } from '../types.js';
import {
  FORBIDDEN_CLASSNAME_PATTERNS,
  STYLE_PATTERN,
  isForbiddenClassToken,
  findAppearanceProp,
  findSizeProp,
} from '../rules.js';

interface Violation {
  component: string;
  rule: string;
  found: string;
  fix: string;
  severity: 'error';
}

export function checkUsageTool(
  server: McpServer,
  getComponents: () => Promise<ParsedComponent[]>,
  ensureProps: (component: ParsedComponent) => Promise<ParsedComponent>
): void {
  server.registerTool(
    'dskit_check_usage',
    {
      description:
        'Check if a JSX/TSX snippet correctly uses design system components. Returns violations and suggested fixes. Use before finalizing any component code.',
      inputSchema: {
        code: z
          .string()
          .describe('The JSX/TSX code to validate. Can be a single component usage or a block of code.'),
      },
    },
    async ({ code }) => {
      try {
        const components = await getComponents();
        const componentNames = new Set(components.map((c) => c.name));
        const violations: Violation[] = [];
        let correctedCode = code;

        const tagRegex = /<([A-Z][A-Za-z0-9]*)((?:\s+[^<>]*?)?)\/?>/g;
        let match: RegExpExecArray | null;

        while ((match = tagRegex.exec(code)) !== null) {
          const [fullTag, tagName, attrs] = match;
          if (!componentNames.has(tagName)) continue;

          const component = components.find((c) => c.name === tagName)!;
          let hadColorViolation = false;
          let hadPaddingViolation = false;

          for (const { pattern, rule, fix } of FORBIDDEN_CLASSNAME_PATTERNS) {
            const found = attrs.match(pattern);
            if (found) {
              violations.push({ component: tagName, rule, found: found[0], fix, severity: 'error' });
              if (rule === 'className color override') hadColorViolation = true;
              if (rule === 'className padding override') hadPaddingViolation = true;
            }
          }
          if (STYLE_PATTERN.test(attrs)) {
            violations.push({
              component: tagName,
              rule: 'inline style override',
              found: attrs.match(STYLE_PATTERN)![0],
              fix: 'Use component props instead of inline styles',
              severity: 'error',
            });
          }

          // Build a best-effort corrected version of this tag.
          let newAttrs = attrs
            .replace(STYLE_PATTERN, '')
            .replace(/className=(["'])([^"']*)\1/, (_m, quote, classNameValue) => {
              const kept = classNameValue
                .split(/\s+/)
                .filter((t: string) => t && !isForbiddenClassToken(t));
              return kept.length > 0 ? `className=${quote}${kept.join(' ')}${quote}` : '';
            })
            .replace(/\s{2,}/g, ' ')
            .trimEnd();

          if (hadColorViolation || hadPaddingViolation) {
            await ensureProps(component);
          }

          if (hadColorViolation) {
            const appearance = findAppearanceProp(component.props);
            if (appearance && !newAttrs.includes(`${appearance.name}=`)) {
              const value = appearance.default ?? appearance.options?.[0] ?? '';
              newAttrs += ` ${appearance.name}="${value}"`;
            }
          }
          if (hadPaddingViolation) {
            const size = findSizeProp(component.props);
            if (size && !newAttrs.includes(`${size.name}=`)) {
              const value = size.default ?? size.options?.[0] ?? '';
              newAttrs += ` ${size.name}="${value}"`;
            }
          }

          const newTag = `<${tagName}${newAttrs ? ' ' + newAttrs.trim() : ''}${fullTag.endsWith('/>') ? ' />' : '>'}`;
          correctedCode = correctedCode.replace(fullTag, newTag);
        }

        const result = {
          valid: violations.length === 0,
          violations,
          correctedCode: violations.length > 0 ? correctedCode : undefined,
        };

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: `Could not check usage: ${error.message}`,
                suggestion: 'Check that the configured Storybook URL is public and accessible.',
              }),
            },
          ],
        };
      }
    }
  );
}
