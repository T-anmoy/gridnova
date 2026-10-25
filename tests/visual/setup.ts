import { rmSync } from "node:fs";
import { OUT_DIR } from "./matrix";

// Start every run from an empty report folder so the summary never mixes runs.
export default function setup(): void {
  rmSync(`${OUT_DIR}/report`, { recursive: true, force: true });
}
