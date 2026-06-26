import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ParsedComponent } from '../types.js';

export function listComponentsTool(
  server: McpServer,
  getComponents: () => Promise<ParsedComponent[]>
): void {
  server.registerTool(
    'dskit_list_components',
    {
      description:
        'List all available components in the design system. Returns component names, categories, and variant counts. Use this first to discover what is available before writing any UI code.',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe(
            "Filter by category (e.g. 'Actions', 'Forms', 'Navigation'). Omit to get all."
          ),
      },
    },
    async ({ category }) => {
      try {
        const components = await getComponents();
        const filtered = category
          ? components.filter((c) => c.category.toLowerCase() === category.toLowerCase())
          : components;

        const categories = [...new Set(components.map((c) => c.category))];

        const result = {
          total: filtered.length,
          categories,
          components: filtered.map((c) => ({
            name: c.name,
            category: c.category,
            variantCount: c.variants.length,
            hasProps: c.props.length > 0,
          })),
        };

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: `Could not list components: ${error.message}`,
                suggestion: 'Check that the configured Storybook URL is public and accessible.',
              }),
            },
          ],
        };
      }
    }
  );
}
