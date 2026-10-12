// Copies the Anakin skills from Anakin-Inc/agent-skills into skills/, so the plugin
// ships the same skills as the Claude, Codex, Cursor and other plugins.
// Usage: node scripts/sync-skills.mjs <path to an agent-skills checkout>
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const source = join(process.argv[2] ?? "../agent-skills", "skills");
if (!existsSync(source)) {
  console.error(`No skills directory at ${source}`);
  process.exit(1);
}
// Only skill folders (each with a SKILL.md); stray files such as .DS_Store stay behind.
const skills = readdirSync(source, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(source, entry.name, "SKILL.md")))
  .map((entry) => entry.name);
rmSync("skills", { recursive: true, force: true });
for (const name of skills) cpSync(join(source, name), join("skills", name), { recursive: true });
console.log(`Synced ${skills.length} skills from ${source}: ${skills.join(", ")}`);
