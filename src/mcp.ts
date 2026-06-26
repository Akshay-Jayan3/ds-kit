import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StorybookCache } from './storybook/cache.js';
import { fetchStoriesIndex, fetchStorybookMetadata } from './storybook/fetcher.js';
import { groupStoriesByComponent, buildPartialComponent } from './storybook/parser.js';
import { extractPropsFromArgTypes, scrapeComponentProps } from './docsScraper.js';
import { listComponentsTool } from './tools/listComponents.js';
import { getComponentTool } from './tools/getComponent.js';
import { searchComponentsTool } from './tools/searchComponents.js';
import { checkUsageTool } from './tools/checkUsage.js';
import { getGlobalRulesTool } from './tools/getGlobalRules.js';
import { ParsedComponent, StorybookStory, StorybookMetadata } from './types.js';

export async function createServer(storybookUrl: string) {
  const server = new McpServer({
    name: 'dskit',
    version: '1.0.0',
  });

  const cache = new StorybookCache();
  let storiesByComponent = new Map<string, StorybookStory[]>();
  let metadata: StorybookMetadata | null = null;

  // Shared function: get components (from cache or fresh fetch)
  async function getComponents(): Promise<ParsedComponent[]> {
    const cached = cache.get<ParsedComponent[]>('components');
    if (cached) return cached;

    const index = await fetchStoriesIndex(storybookUrl);
    storiesByComponent = groupStoriesByComponent(index);
    metadata = await fetchStorybookMetadata(storybookUrl);

    const components: ParsedComponent[] = [];
    for (const [name, stories] of storiesByComponent) {
      components.push({
        ...buildPartialComponent(name, stories, storybookUrl),
        description: '',
        props: [], // filled in lazily by ensureProps, only for components actually requested
      });
    }

    components.sort((a, b) => a.name.localeCompare(b.name));
    cache.set('components', components);
    return components;
  }

  // Props aren't extracted for every component up front — that would mean
  // scraping every component's docs page on every cache miss. Instead,
  // resolve props the first time a specific component is requested
  // (argTypes first, since it's structured data straight from Storybook's
  // build; HTML scraping only as a fallback), then mutate the component in
  // place so it stays resolved for the rest of the cache window.
  async function ensureProps(component: ParsedComponent): Promise<ParsedComponent> {
    if (component.props.length > 0) return component;

    const stories = storiesByComponent.get(component.name) || [];
    const storyArgTypes = stories.find((s) => s.argTypes)?.argTypes;
    const metadataArgTypes = metadata?.[component.name]?.argTypes;
    const argTypes = storyArgTypes || metadataArgTypes;

    if (argTypes) {
      component.props = extractPropsFromArgTypes(argTypes);
      return component;
    }

    if (component.hasAutodocs) {
      const scraped = await scrapeComponentProps(component.docsUrl);
      component.description = component.description || scraped.description;
      component.props = scraped.props;
    }

    return component;
  }

  // Register all tools
  listComponentsTool(server, getComponents);
  getComponentTool(server, getComponents, ensureProps);
  searchComponentsTool(server, getComponents);
  checkUsageTool(server, getComponents, ensureProps);
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
