import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { OUT_DIR, PAGES, VIEWPORTS, slug, type Finding } from "./matrix";

// Global teardown of the visual matrix: one table of page × viewport, plus the
// findings that are reported rather than asserted (small tap targets, image
// problems). Written to test-results/visual-matrix/summary.md.
export default function summary(): void {
  const dir = `${OUT_DIR}/report`;
  if (!existsSync(dir)) return;
  const reports = new Map<string, { scrollWidth: number; innerWidth: number; findings: Finding[]; finalUrl: string }>();
  for (const f of readdirSync(dir)) reports.set(f.replace(/\.json$/, ""), JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));

  const cell = (path: string, vp: string) => {
    const r = reports.get(`${slug(path)}__${vp}`);
    if (!r) return "—";
    const fails = r.findings.filter((f) => ["overflow", "collapsed", "overlap", "covered-fixed", "unreachable"].includes(f.kind)).length + (r.scrollWidth > r.innerWidth ? 1 : 0);
    const notes = r.findings.length - fails;
    return fails ? `**FAIL ${fails}**` : notes ? `ok (${notes})` : "ok";
  };
  const lines = [
    "# Visual matrix",
    "",
    "`FAIL n` = overflow / unreachable / overlap assertions failed; `ok (n)` = passed with n reported notes (tap targets, images). `—` = not run.",
    "",
    `| page | ${VIEWPORTS.map((v) => v.name).join(" | ")} |`,
    `|---|${VIEWPORTS.map(() => "---").join("|")}|`,
    ...PAGES.map((p) => `| ${p.path} | ${VIEWPORTS.map((v) => cell(p.path, v.name)).join(" | ")} |`),
    "",
    "## Findings",
    "",
  ];
  // Group identical findings across viewports so the list stays readable.
  const grouped = new Map<string, string[]>();
  for (const [key, r] of reports) {
    const vp = key.split("__")[1];
    for (const f of r.findings) {
      const k = `${r.finalUrl.replace(/^https?:\/\/[^/]+/, "")} · ${f.kind} · ${f.detail.replace(/ \d+×\d+$/, "")}`;
      grouped.set(k, [...(grouped.get(k) ?? []), vp]);
    }
  }
  for (const [k, vps] of [...grouped].sort()) lines.push(`- ${k} — ${vps.length} viewport(s): ${vps.join(", ")}`);
  writeFileSync(`${OUT_DIR}/summary.md`, lines.join("\n") + "\n");
  console.log(`[visual] summary written to ${OUT_DIR}/summary.md (${reports.size} page×viewport reports)`);
}
