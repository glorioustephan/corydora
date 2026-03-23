export interface ParsedFrontmatter {
  attributes: Record<string, string>;
  body: string;
}

export function parseMarkdownFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return {
      attributes: {},
      body: raw,
    };
  }

  const [, frontmatterBlock = '', body = ''] = match;
  const attributes = frontmatterBlock.split('\n').reduce<Record<string, string>>((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key.length > 0 && value.length > 0) {
      acc[key] = value;
    }

    return acc;
  }, {});

  return {
    attributes,
    body,
  };
}
