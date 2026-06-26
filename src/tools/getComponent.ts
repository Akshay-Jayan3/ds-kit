import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ParsedComponent } from '../types.js';
import { buildComponentRules } from '../rules.js';

export function getComponentTool(
  server: McpServer,
  getComponents: () => Promise<ParsedComponent[]>,
  ensureProps: (component: ParsedComponent) => Promise<ParsedComponent>
): void {
  server.registerTool(
    'dskit_get_component',
    {
      description:
        'Get complete details for a specific component: props, variants, usage rules, and what className is and is not allowed. Always call this before using any component in generated code.',
      inputSchema: {
        name: z
          .string()
          .describe(
            'Component name exactly as it appears in the design system. Use dskit_list_components first if unsure.'
          ),
      },
    },
    async ({ name }) => {
      try {
        const components = await getComponents();
        const component = components.find((c) => c.name.toLowerCase() === name.toLowerCase());

        if (!component) {
          const suggestions = components
            .filter((c) => c.name.toLowerCase().includes(name.toLowerCase()))
            .slice(0, 5)
            .map((c) => c.name);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: true,
                  message: `Component "${name}" not found.`,
                  suggestion:
                    suggestions.length > 0
                      ? `Did you mean: ${suggestions.join(', ')}?`
                      : 'Call dskit_list_components to see what is available.',
                }),
              },
            ],
          };
        }

        await ensureProps(component);

        const result = {
          name: component.name,
          category: component.category,
          description: component.description,
          variants: component.variants,
          props: component.props,
          rules: buildComponentRules(component),
          docsUrl: component.docsUrl,
        };

        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: `Could not get component "${name}": ${error.message}`,
                suggestion: 'Check that the configured Storybook URL is public and accessible.',
              }),
            },
          ],
        };
      }
    }
  );
}
