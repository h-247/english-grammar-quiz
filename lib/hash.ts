function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  const sorted: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key]);
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
  const msgBuffer = new TextEncoder().encode(canonicalJson);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
