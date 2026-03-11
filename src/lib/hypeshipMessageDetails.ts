function truncate(value: string, max = 80): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export function parseToolDetail(detail: unknown): unknown {
  if (typeof detail !== "string") return detail;
  try {
    return JSON.parse(detail);
  } catch {
    return detail;
  }
}

export function isDetailObject(
  detail: unknown,
): detail is Record<string, unknown> {
  return !!detail && typeof detail === "object" && !Array.isArray(detail);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function getToolDetailSummary(detail: unknown): string {
  const parsed = parseToolDetail(detail);

  if (typeof parsed === "string") {
    return truncate(parsed);
  }

  if (Array.isArray(parsed)) {
    return parsed.length > 0 ? `${parsed.length} items` : "";
  }

  if (!isDetailObject(parsed)) {
    return "";
  }

  const filePath = stringValue(parsed.file_path);
  if (filePath) return truncate(filePath);

  const command = stringValue(parsed.command);
  if (command) return truncate(command);

  const path = stringValue(parsed.path);
  const pattern = stringValue(parsed.pattern);
  if (path && pattern) return truncate(`${path} · ${pattern}`);
  if (path) return truncate(path);

  const globPattern = stringValue(parsed.glob_pattern);
  if (globPattern) return truncate(globPattern);

  const query = stringValue(parsed.query);
  if (query) return truncate(query);

  const searchTerm = stringValue(parsed.search_term);
  if (searchTerm) return truncate(searchTerm);

  const prompt = stringValue(parsed.prompt);
  if (prompt) return truncate(prompt);

  const url = stringValue(parsed.url);
  if (url) return truncate(url);

  if (Array.isArray(parsed.repos) && parsed.repos.length > 0) {
    return truncate(parsed.repos.join(", "));
  }

  if (Array.isArray(parsed.todos) && parsed.todos.length > 0) {
    return `${parsed.todos.length} todos`;
  }

  const description = stringValue(parsed.description);
  if (description) return truncate(description);

  const subagentType = stringValue(parsed.subagent_type);
  if (subagentType) return `${subagentType} subagent`;

  return truncate(JSON.stringify(parsed));
}

export function getToolDetailBody(detail: unknown): string {
  const parsed = parseToolDetail(detail);

  if (parsed == null) return "";
  if (typeof parsed === "string") return parsed;

  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return "";
  }
}
