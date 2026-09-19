import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Hash committed UTF-8 text artifacts using the repository's existing CRLF
 * checksum contract, regardless of the checkout's native line endings.
 */
export function sha256CanonicalText(text: string): string {
  const lfText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const canonicalText = lfText.replace(/\n/g, "\r\n");
  return createHash("sha256").update(Buffer.from(canonicalText, "utf8")).digest("hex");
}

export async function sha256CanonicalTextFile(filePath: string): Promise<string> {
  return sha256CanonicalText(await readFile(filePath, "utf8"));
}
