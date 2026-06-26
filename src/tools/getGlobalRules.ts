import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GLOBAL_RULES } from '../rules.js';

export function getGlobalRulesTool(server: McpServer): void {
  server.registerTool(
    'dskit_get_global_rules',
    {
      description:
        'Get the global design system governance rules that apply to all components. Call this at the start of any session involving design system components.',
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: 'text', text: JSON.stringify(GLOBAL_RULES) }],
      };
    }
  );
}
