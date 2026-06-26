import { StorybookIndex, StorybookStory, ParsedComponent } from '../types.js';

export function groupStoriesByComponent(index: StorybookIndex): Map<string, StorybookStory[]> {
  // Handle both v6 (stories) and v7 (entries) formats
  const allStories = index.entries || index.stories || {};
  const groups = new Map<string, StorybookStory[]>();

  for (const [id, story] of Object.entries(allStories)) {
    // Skip docs-only entries
    if (story.type === 'docs' || id.endsWith('--docs')) continue;

    // title is like "Components/Button" or "Forms/Input/Text Input"
    const componentName = extractComponentName(story.title);

    if (!groups.has(componentName)) {
      groups.set(componentName, []);
    }
    groups.get(componentName)!.push(story);
  }

  return groups;
}

export function extractComponentName(title: string): string {
  // "Components/Button" → "Button"
  // "Forms/Input" → "Input"
  // "Design System/Actions/Button" → "Button"
  const parts = title.split('/');
  return parts[parts.length - 1].trim();
}

export function extractCategory(title: string): string {
  // "Components/Button" → "Components"
  // "Forms/Input" → "Forms"
  const parts = title.split('/');
  return parts.length > 1 ? parts[0].trim() : 'General';
}

export function buildDocsUrl(baseUrl: string, title: string): string {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  // Convert "Components/Button" to "components-button"
  const slug = title
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  return `${cleanUrl}/?path=/docs/${slug}--docs`;
}

export function extractVariantsFromStories(stories: StorybookStory[]): string[] {
  return stories
    .map((s) => s.name)
    .filter(
      (name) =>
        name !== 'Default' &&
        name !== 'Playground' &&
        name !== 'Overview' &&
        !name.startsWith('_')
    );
}

export function buildPartialComponent(
  name: string,
  stories: StorybookStory[],
  baseUrl: string
): Omit<ParsedComponent, 'props' | 'description'> {
  const firstStory = stories[0];
  return {
    name,
    category: extractCategory(firstStory.title),
    variants: extractVariantsFromStories(stories),
    storyIds: stories.map((s) => s.id),
    docsUrl: buildDocsUrl(baseUrl, firstStory.title),
    hasAutodocs: stories.some((s) => s.tags?.includes('autodocs')),
  };
}
