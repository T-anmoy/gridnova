import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import hi from "@/messages/hi.json";
import bn from "@/messages/bn.json";

// Every key path in a message file, with arrays compared by index so a
// translated list can't silently drop or add an item.
function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

function leaves(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value && typeof value === "object") return Object.values(value).flatMap(leaves);
  return [value];
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

describe("message files", () => {
  const enPaths = paths(en).filter((p) => !p.startsWith("_"));

  for (const [name, file] of [["hi", hi], ["bn", bn]] as const) {
    it(`${name}.json has exactly the same keys as en.json`, () => {
      const own = paths(file).filter((p) => !p.startsWith("_"));
      expect(own.filter((p) => !enPaths.includes(p))).toEqual([]);
      expect(enPaths.filter((p) => !own.includes(p))).toEqual([]);
    });

    it(`${name}.json is flagged as an unreviewed machine draft until a native speaker signs off`, () => {
      expect((file as { _review_status?: string })._review_status).toBe("machine-draft");
    });

    it(`${name}.json keeps every {placeholder} its English source has`, () => {
      const enLeafValues = leaves(en);
      const enLeaves = new Map(paths(en).map((p, i) => [p, enLeafValues[i]]));
      const own = paths(file);
      const ownLeaves = leaves(file);
      own.forEach((p, i) => {
        const source = enLeaves.get(p);
        if (typeof source === "string" && typeof ownLeaves[i] === "string") {
          expect(`${p}: ${placeholders(ownLeaves[i] as string)}`).toBe(`${p}: ${placeholders(source)}`);
        }
      });
    });
  }

  // Two keys are deliberately blank: `dropCap` (a Latin-only device) and
  // `proof` where no documented figure exists — never filled with a guess.
  it("has no empty strings in any locale (a blank would render as a missing label)", () => {
    for (const file of [en, hi, bn]) {
      const fileLeaves = leaves(file);
      const empties = paths(file).filter(
        (p, i) => fileLeaves[i] === "" && !p.endsWith("dropCap") && !p.endsWith(".proof"),
      );
      expect(empties).toEqual([]);
    }
  });

  it("en.json is the reviewed source", () => {
    expect((en as { _review_status?: string })._review_status).toBe("source");
  });
});
