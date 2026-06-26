import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import { fetchStoriesIndex, fetchStorybookMetadata } from './storybook/fetcher.js';
import { groupStoriesByComponent, buildPartialComponent } from './storybook/parser.js';
import { scrapeComponentProps, extractPropsFromArgTypes } from './docsScraper.js';
import { generateMCPConfig, generateMarkdown } from './generator.js';
import { generateRules } from './rulesGenerator.js';
import { ParsedComponent, DSKitOptions } from './types.js';

export function runCli(argv: string[]): void {
  const program = new Command();

  program
    .name('dskit')
    .description('Generate MCP config and documentation from your Storybook')
    .version('1.0.0')
    .requiredOption('--url <url>', 'Public Storybook URL')
    .option('--output <dir>', 'Output directory', '.')
    .option('--skip-docs', 'Skip prop scraping (faster, less detail)', false)
    .option(
      '--experimental-props',
      'Attempt structured prop extraction via storybook-metadata.json / argTypes',
      false
    )
    .option('--verbose', 'Show detailed logs', false)
    .action(async (options: DSKitOptions) => {
      console.log(chalk.bold.cyan('\n🎨 DSKit — Design System MCP Generator\n'));

      const outputDir = path.resolve(options.output || '.');

      // Step 1: Fetch stories index
      const fetchSpinner = ora('Fetching Storybook index...').start();
      let index;
      try {
        index = await fetchStoriesIndex(options.url);
        fetchSpinner.succeed(chalk.green('Storybook index fetched'));
      } catch (error: any) {
        fetchSpinner.fail(chalk.red(error.message));
        process.exit(1);
      }

      // Step 2: Group stories by component
      const groupSpinner = ora('Parsing components...').start();
      const groups = groupStoriesByComponent(index);

      if (groups.size === 0) {
        groupSpinner.fail(
          chalk.red(
            'No components found. Check that the URL is correct (try with or without a trailing path).'
          )
        );
        process.exit(1);
      }

      groupSpinner.succeed(chalk.green(`Found ${groups.size} components`));

      // Step 2.5: Optionally fetch structured argTypes metadata (Storybook v7.6+).
      // This is preferred over HTML scraping when available — it's straight from
      // Storybook's own build, not reconstructed from rendered markup.
      let metadata: Record<string, { argTypes?: Record<string, any> }> | null = null;
      if (options.experimentalProps) {
        const metaSpinner = ora('Checking for storybook-metadata.json...').start();
        metadata = await fetchStorybookMetadata(options.url);
        if (metadata) {
          metaSpinner.succeed(chalk.green('storybook-metadata.json found — using structured props'));
        } else {
          metaSpinner.warn(chalk.yellow('storybook-metadata.json not available, falling back'));
        }
      }

      // Step 3: Build component list with optional prop scraping
      const components: ParsedComponent[] = [];
      const scrapeSpinner = ora('Building component data...').start();
      let componentsMissingProps = 0;

      for (const [name, stories] of groups) {
        const partial = buildPartialComponent(name, stories, options.url);

        let description = '';
        let props: ParsedComponent['props'] = [];

        if (options.experimentalProps) {
          const storyArgTypes = stories.find((s) => s.argTypes)?.argTypes;
          const metadataArgTypes = metadata?.[name]?.argTypes;
          const argTypes = storyArgTypes || metadataArgTypes;
          if (argTypes) {
            props = extractPropsFromArgTypes(argTypes);
          }
        }

        if (props.length === 0 && !options.skipDocs && partial.hasAutodocs) {
          if (options.verbose) {
            scrapeSpinner.text = `Scraping props for ${name}...`;
          }
          const scraped = await scrapeComponentProps(partial.docsUrl);
          description = scraped.description;
          props = scraped.props;
        }

        if (props.length === 0) componentsMissingProps++;

        components.push({
          ...partial,
          description,
          props,
        });
      }

      // Sort alphabetically
      components.sort((a, b) => a.name.localeCompare(b.name));
      scrapeSpinner.succeed(chalk.green(`Processed ${components.length} components`));

      if (componentsMissingProps > 0) {
        const suffix = options.experimentalProps
          ? ''
          : ' (run with --experimental-props to attempt structured extraction)';
        console.log(
          chalk.yellow(
            `⚠  Props not available for ${componentsMissingProps} components (Storybook client-renders prop tables)${suffix}`
          )
        );
      }

      // Step 4: Generate output files
      const writeSpinner = ora('Writing output files...').start();
      try {
        generateMCPConfig(components, options.url, outputDir);
        generateMarkdown(components, options.url, outputDir);
        generateRules(components, options.url, outputDir);
        writeSpinner.succeed(chalk.green('Files written'));
      } catch (error: any) {
        writeSpinner.fail(chalk.red(`Failed to write files: ${error.message}`));
        process.exit(1);
      }

      // Done
      console.log(chalk.bold.green('\n✅ Done!\n'));
      console.log(chalk.white('Generated files:'));
      console.log(chalk.cyan(`  → ${path.join(outputDir, 'COMPONENTS.md')}`));
      console.log(chalk.cyan(`  → ${path.join(outputDir, 'mcp-config.json')}`));
      console.log(chalk.cyan(`  → ${path.join(outputDir, 'RULES.md')}`));
      console.log('');
      console.log(chalk.white('Next step:'));
      console.log(chalk.gray('  Drop all three files in your project root.'));
      console.log(chalk.gray('  Cursor and Claude Code will automatically pick them up.'));
      console.log('');
    });

  program.parse(argv);
}
