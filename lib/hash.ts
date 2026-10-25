const BYTE_TO_HEX: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, '0')
);

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += BYTE_TO_HEX[bytes[i]];
  }
  return hex;
}

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const record = obj as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(record).sort();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    sorted[key] = sortKeys(record[key]);
  }
  return sorted;
}

export async function calculateContentHash(data: unknown): Promise<string> {
  let canonicalJson: string;
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      canonicalJson = JSON.stringify(sortKeys(parsed));
    } catch {
      canonicalJson = data;
    }
  } else {
    canonicalJson = JSON.stringify(sortKeys(data));
  }

  const msgBuffer = textEncoder.encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return bytesToHex(new Uint8Array(hashBuffer));
}
