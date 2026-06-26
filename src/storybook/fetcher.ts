import axios from 'axios';
import { StorybookIndex, StorybookMetadata } from '../types.js';

export async function fetchStoriesIndex(baseUrl: string): Promise<StorybookIndex> {
  // Storybook v7+ uses index.json, v6 uses stories.json
  // Try index.json first, fall back to stories.json
  const cleanUrl = baseUrl.replace(/\/$/, '');

  try {
    const response = await axios.get(`${cleanUrl}/index.json`, { timeout: 15000 });
    return response.data;
  } catch {
    try {
      const response = await axios.get(`${cleanUrl}/stories.json`, { timeout: 15000 });
      return response.data;
    } catch (error) {
      throw new Error(
        `Could not fetch Storybook index from ${cleanUrl}.\n` +
        `Make sure the URL is correct and the Storybook is publicly accessible.\n` +
        `Tried: ${cleanUrl}/index.json and ${cleanUrl}/stories.json`
      );
    }
  }
}

export async function fetchProjectConfig(baseUrl: string): Promise<Record<string, any>> {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  try {
    const response = await axios.get(`${cleanUrl}/project.json`, { timeout: 5000 });
    return response.data;
  } catch {
    return {}; // project.json is optional, don't fail if missing
  }
}

// Storybook v7.6+ optionally exposes structured argTypes for every component
// at this endpoint. Not all Storybooks publish it — treat absence as normal,
// not an error.
export async function fetchStorybookMetadata(baseUrl: string): Promise<StorybookMetadata | null> {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  try {
    const response = await axios.get(`${cleanUrl}/storybook-metadata.json`, { timeout: 10000 });
    return response.data;
  } catch {
    return null;
  }
}
