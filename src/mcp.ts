import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StorybookCache } from './storybook/cache.js';
import { fetchStoriesIndex } from './storybook/fetcher.js';
import { groupStoriesByComponent, buildPartialComponent } from './storybook/parser.js';
import { listComponentsTool } from './tools/listComponents.js';
import { getComponentTool } from './tools/getComponent.js';
import { searchComponentsTool } from './tools/searchComponents.js';
import { checkUsageTool } from './tools/checkUsage.js';
import { getGlobalRulesTool } from './tools/getGlobalRules.js';
import { ParsedComponent } from './types.js';

export async function createServer(storybookUrl: string) {
  const server = new McpServer({
    name: 'dskit',
    version: '1.0.0',
  });

  const cache = new StorybookCache();

  // Shared function: get components (from cache or fresh fetch)
  async function getComponents(): Promise<ParsedComponent[]> {
    const cached = cache.get<ParsedComponent[]>('components');
    if (cached) return cached;

    const index = await fetchStoriesIndex(storybookUrl);
    const groups = groupStoriesByComponent(index);
    const components: ParsedComponent[] = [];

    for (const [name, stories] of groups) {
      components.push({
        ...buildPartialComponent(name, stories, storybookUrl),
        description: '',
        props: [], // Props via MCP API in v3
      });
    }

    components.sort((a, b) => a.name.localeCompare(b.name));
    cache.set('components', components);
    return components;
  }

  // Register all tools
  listComponentsTool(server, getComponents);
  getComponentTool(server, getComponents);
  searchComponentsTool(server, getComponents);
  checkUsageTool(server, getComponents);
  getGlobalRulesTool(server);

  return server;
}

export async function startServer(storybookUrl: string) {
  const server = await createServer(storybookUrl);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP stdio servers must NOT write to stdout after this point
  // All logging goes to stderr
  process.stderr.write('DSKit MCP server running\n');
}
