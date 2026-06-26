export interface StorybookStory {
  id: string;
  title: string;
  name: string;
  kind?: string;
  story?: string;
  type?: string;
  parameters?: Record<string, any>;
  tags?: string[];
  argTypes?: Record<string, StorybookArgType>;
}

export interface StorybookIndex {
  v: number;
  stories?: Record<string, StorybookStory>;
  entries?: Record<string, StorybookStory>; // v7 uses entries instead of stories
}

export interface StorybookArgType {
  name?: string;
  type?: { name?: string; value?: any };
  control?: { type?: string };
  table?: {
    type?: { summary?: string };
    defaultValue?: { summary?: string };
    category?: string;
  };
  defaultValue?: any;
  description?: string;
  required?: boolean;
  options?: string[];
}

// Shape of the optional /storybook-metadata.json endpoint (Storybook v7.6+).
// Keyed by component title/name, each entry exposes argTypes the same way
// an individual story's parameters.docs.argTypes would.
export type StorybookMetadata = Record<
  string,
  { argTypes?: Record<string, StorybookArgType> }
>;

export interface ComponentProp {
  name: string;
  type: string;
  options?: string[];
  default?: string | boolean | number;
  description?: string;
  required?: boolean;
}

export interface ParsedComponent {
  name: string;
  category: string;
  description: string;
  props: ComponentProp[];
  variants: string[];
  storyIds: string[];
  docsUrl: string;
  hasAutodocs: boolean;
}

export interface DSKitConfig {
  name: string;
  version: string;
  generatedAt: string;
  storybookUrl: string;
  totalComponents: number;
  components: ParsedComponent[];
}

export interface DSKitOptions {
  url: string;
  output?: string;
  verbose?: boolean;
  skipDocs?: boolean;
  experimentalProps?: boolean;
}
