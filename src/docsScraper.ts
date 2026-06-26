import axios from 'axios';
import * as cheerio from 'cheerio';
import { ComponentProp, StorybookArgType } from './types.js';

// Converts Storybook's own argTypes shape (from index.json entries or
// storybook-metadata.json) into our ComponentProp[]. This is structured data
// straight from Storybook's build — no scraping, no client-render problem.
export function extractPropsFromArgTypes(
  argTypes: Record<string, StorybookArgType>
): ComponentProp[] {
  const props: ComponentProp[] = [];

  for (const [name, argType] of Object.entries(argTypes)) {
    if (!argType) continue;
    const typeSummary = argType.type?.name || argType.table?.type?.summary || '';
    const options = argType.options?.length
      ? argType.options.map(String)
      : typeSummary.includes('|')
        ? typeSummary.split('|').map((o) => o.trim().replace(/['"]/g, '')).filter(Boolean)
        : undefined;

    props.push({
      name,
      type: options ? 'enum' : typeSummary || 'any',
      options,
      default: argType.table?.defaultValue?.summary ?? argType.defaultValue,
      description: argType.description,
      required: argType.required,
    });
  }

  return props;
}

export async function scrapeComponentProps(docsUrl: string): Promise<{
  description: string;
  props: ComponentProp[];
}> {
  try {
    // Fetch the iframe version which has cleaner HTML
    const iframeUrl = docsUrl
      .replace('/?path=/docs/', '/iframe.html?id=')
      .replace('--docs', '--docs&viewMode=docs');

    const response = await axios.get(iframeUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'DSKit/1.0 (Design System MCP Generator)',
      },
    });

    const $ = cheerio.load(response.data);

    const description = extractDescription($);
    const props = extractPropsTable($);

    return { description, props };
  } catch {
    // If scraping fails, return empty — don't break the whole run
    return { description: '', props: [] };
  }
}

function extractDescription($: cheerio.CheerioAPI): string {
  // Storybook autodocs renders description in a <p> before the prop table
  const descriptionEl = $('[class*="sbdocs-p"]').first();
  return descriptionEl.text().trim() || '';
}

function extractPropsTable($: cheerio.CheerioAPI): ComponentProp[] {
  const props: ComponentProp[] = [];

  // Storybook renders an ArgsTable — find each row
  $('tr[class*="docblock-argstable"]').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const name = $(cells[0]).text().trim();
    const typeText = $(cells[1]).text().trim();
    const defaultVal = $(cells[3])?.text().trim() || '';
    const description = $(cells[4])?.text().trim() || '';

    if (!name || name === 'Name') return; // skip header row

    props.push({
      name,
      type: parseType(typeText),
      options: extractOptions(typeText),
      default: defaultVal || undefined,
      description: description || undefined,
      required: $(cells[0]).find('[class*="required"]').length > 0,
    });
  });

  return props;
}

function parseType(typeText: string): string {
  if (typeText.includes('|')) return 'enum';
  if (typeText.includes('boolean')) return 'boolean';
  if (typeText.includes('number')) return 'number';
  if (typeText.includes('string')) return 'string';
  if (typeText.includes('ReactNode') || typeText.includes('node')) return 'node';
  if (typeText.includes('func') || typeText.includes('() =>')) return 'function';
  return typeText.split('\n')[0].trim() || 'any';
}

function extractOptions(typeText: string): string[] | undefined {
  if (!typeText.includes('|')) return undefined;
  return typeText
    .split('|')
    .map((o) => o.trim().replace(/['"]/g, ''))
    .filter(Boolean);
}
