import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ParsedComponent } from '../types.js';

function scoreComponent(component: ParsedComponent, query: string): number {
  const q = query.toLowerCase();
  const name = component.name.toLowerCase();
  const category = component.category.toLowerCase();
  const variants = component.variants.map((v) => v.toLowerCase()).join(' ');

  let score = 0;
  if (name === q) score += 1.0;
  if (name.includes(q)) score += 0.7;
  if (category.includes(q)) score += 0.4;
  if (variants.includes(q)) score += 0.3;
  // Also check if query words appear in name
  q.split(' ').forEach((word) => {
    if (word && name.includes(word)) score += 0.2;
  });
  return Math.min(score, 1.0);
}

export function searchComponentsTool(
  server: McpServer,
  getComponents: () => Promise<ParsedComponent[]>
): void {
  server.registerTool(
    'dskit_search_components',
    {
      description:
        'Search for components by name, purpose, or category using natural language. Use when you know what you want to build but not the exact component name.',
      inputSchema: {
        query: z
          .string()
          .describe(
            "Natural language description of what you need. Examples: 'notification', 'dropdown menu', 'loading spinner', 'date picker'"
          ),
        limit: z.number().optional().default(5).describe('Max results to return'),
      },
    },
    async ({ query, limit }) => {
      try {
        const components = await getComponents();
        const results = components
          .map((c) => ({ component: c, score: scoreComponent(c, query) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit ?? 5)
          .map((r) => ({
            name: r.component.name,
            category: r.component.category,
            score: Math.round(r.score * 100) / 100,
            docsUrl: r.component.docsUrl,
          }));

        return {
          content: [{ type: 'text', text: JSON.stringify({ query, results }) }],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: `Could not search components: ${error.message}`,
                suggestion: 'Check that the configured Storybook URL is public and accessible.',
              }),
            },
          ],
        };
      }
    }
  );
}
