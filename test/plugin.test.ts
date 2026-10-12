import assert from "node:assert/strict";
import { test } from "node:test";
import plugin, { bundledSkills, SERVER_NAME, SERVER_URL, skillsDir } from "../index.ts";

const SKILLS = ["anakin-browser", "anakin-monitoring", "anakin-research", "anakin-web-data", "anakin-wire"];

test("bundles the five Anakin skills with their frontmatter", () => {
  const skills = bundledSkills();
  assert.deepEqual(skills.map((s) => s.id), SKILLS);
  for (const skill of skills) {
    assert.equal(skill.name, skill.id);
    assert.ok(skill.description.startsWith("Use when"), skill.id);
    assert.ok(skill.content.length > 500, skill.id);
    assert.ok(!skill.content.startsWith("---"), `${skill.id}: frontmatter left in the body`);
  }
});

// OpenCode 1

async function v1Config(initial: Record<string, unknown> = {}) {
  const hooks = await plugin.server({} as never);
  const config = structuredClone(initial) as Record<string, any>;
  await hooks.config!(config as never);
  return config;
}

test("OpenCode 1: adds the hosted server and the skills directory", async () => {
  const config = await v1Config();
  assert.deepEqual(config.mcp[SERVER_NAME], { type: "remote", url: SERVER_URL, enabled: true });
  assert.deepEqual(config.skills.paths, [skillsDir]);
});

test("OpenCode 1: keeps the user's own anakin server and other config", async () => {
  const mine = { type: "local", command: ["npx", "-y", "@anakin-io/mcp"], enabled: true };
  const config = await v1Config({
    mcp: { anakin: mine, other: { type: "remote", url: "https://example.com/mcp" } },
    skills: { paths: ["/my/skills"] },
  });
  assert.deepEqual(config.mcp.anakin, mine);
  assert.equal(config.mcp.other.url, "https://example.com/mcp");
  assert.deepEqual(config.skills.paths, ["/my/skills", skillsDir]);
});

test("OpenCode 1: running the hook twice doesn't duplicate the skills path", async () => {
  const hooks = await plugin.server({} as never);
  const config: Record<string, any> = {};
  await hooks.config!(config as never);
  await hooks.config!(config as never);
  assert.deepEqual(config.skills.paths, [skillsDir]);
});

// OpenCode 2

function v2Context(existingServers: Record<string, unknown> = {}, existingSkills: string[] = []) {
  const servers = new Map(Object.entries(existingServers));
  const skills = new Map(existingSkills.map((id) => [id, { id }]));
  const ctx = {
    mcp: {
      transform: async (fn: (e: unknown) => void) =>
        fn({ get: (n: string) => servers.get(n), set: (n: string, c: unknown) => servers.set(n, c) }),
    },
    skill: {
      transform: async (fn: (e: unknown) => void) =>
        fn({ get: (id: string) => skills.get(id), add: (s: { id: string }) => skills.set(s.id, s) }),
    },
  };
  return { ctx, servers, skills };
}

test("OpenCode 2: registers the hosted server and the skills", async () => {
  const { ctx, servers, skills } = v2Context();
  assert.equal(plugin.id, "anakin");
  await plugin.setup(ctx as never);
  assert.deepEqual(servers.get(SERVER_NAME), { type: "remote", url: SERVER_URL });
  assert.deepEqual([...skills.keys()].sort(), SKILLS);
  const web = skills.get("anakin-web-data") as unknown as { path: string; content: string };
  assert.ok(web.path.endsWith("skills/anakin-web-data/SKILL.md"));
});

test("OpenCode 2: keeps a user's own server and skill with the same names", async () => {
  const mine = { type: "remote", url: "https://staging.example.com/mcp" };
  const { ctx, servers, skills } = v2Context({ anakin: mine }, ["anakin-wire"]);
  await plugin.setup(ctx as never);
  assert.deepEqual(servers.get("anakin"), mine);
  assert.deepEqual(skills.get("anakin-wire"), { id: "anakin-wire" });
  assert.equal(skills.size, 5);
});
