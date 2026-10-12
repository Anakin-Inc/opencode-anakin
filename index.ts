import type { Plugin as V1Plugin } from "@opencode-ai/plugin";
import type { Plugin as V2 } from "@opencode/plugin";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The MCP server name users see, and use with `opencode mcp auth anakin`. */
export const SERVER_NAME = "anakin";
/** Anakin's hosted MCP server: 22 tools, OAuth sign-in with dynamic client registration. */
export const SERVER_URL = "https://mcp.anakin.io/mcp";

export const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "skills");

export type BundledSkill = { id: string; name: string; description: string; path: string; content: string };

/**
 * Reads `name` and `description` from a SKILL.md frontmatter block. Covers the plain
 * single-line values the bundled skills use, not general YAML.
 */
function parseSkill(text: string): { fields: Record<string, string>; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { fields: {}, body: text.trim() };
  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const field = /^([\w-]+):\s*(.*)$/.exec(line);
    if (field) fields[field[1]] = field[2].trim();
  }
  return { fields, body: text.slice(match[0].length).trim() };
}

/** The bundled skills, one per directory in skills/. */
export function bundledSkills(): BundledSkill[] {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(skillsDir, entry.name, "SKILL.md");
      const { fields, body } = parseSkill(readFileSync(path, "utf8"));
      return {
        id: entry.name,
        name: fields.name ?? entry.name,
        description: fields.description ?? "",
        path,
        content: body,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** OpenCode 1: adds the server and the skills directory to the config, leaving a user's own `anakin` server alone. */
const server: V1Plugin = async () => ({
  async config(input) {
    input.mcp ??= {};
    if (!input.mcp[SERVER_NAME]) {
      input.mcp[SERVER_NAME] = { type: "remote", url: SERVER_URL, enabled: true };
    }
    // The V1 SDK's Config type omits the runtime `skills` setting.
    const config = input as typeof input & { skills?: { paths?: string[] } };
    config.skills ??= {};
    config.skills.paths ??= [];
    if (!config.skills.paths.includes(skillsDir)) config.skills.paths.push(skillsDir);
  },
});

const plugin: V2.Plugin & { server: V1Plugin } = {
  id: "anakin",
  // OpenCode 1 calls server(); OpenCode 2 reads `id` and calls setup().
  server,
  async setup(ctx: V2.Context) {
    await ctx.mcp.transform((editor) => {
      if (!editor.get(SERVER_NAME)) {
        editor.set(SERVER_NAME, { type: "remote", url: SERVER_URL } as Parameters<typeof editor.set>[1]);
      }
    });
    await ctx.skill.transform((editor) => {
      for (const skill of bundledSkills()) {
        if (editor.get(skill.id)) continue;
        editor.add(skill as unknown as Parameters<typeof editor.add>[0]);
      }
    });
  },
};

export default plugin;
