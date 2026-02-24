// ── Fuzzy Name Matching ──────────────────────────────────────────────
// Ported from mybenefitz-web profile/page.tsx

export function fuzzyMatch(
  input: string,
  verified: string
): { matches: boolean; score: number; isFraud: boolean } {
  if (!input || !verified) return { matches: false, score: 0, isFraud: false };

  const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z]/g, '');
  const inputNorm = normalize(input);
  const verifiedNorm = normalize(verified);

  if (!inputNorm || !verifiedNorm) return { matches: false, score: 0, isFraud: false };

  // Exact match
  if (inputNorm === verifiedNorm) return { matches: true, score: 1, isFraud: false };

  // Initial match (e.g., "S" matches "Shampene")
  if (inputNorm.length <= 3 && verifiedNorm.startsWith(inputNorm)) {
    return { matches: true, score: 0.85, isFraud: false };
  }
  const verifiedParts = verified.toLowerCase().trim().split(/\s+/);
  if (inputNorm.length <= 3) {
    if (verifiedParts.some((part) => part.startsWith(inputNorm))) {
      return { matches: true, score: 0.85, isFraud: false };
    }
  }

  // Contains match
  if (inputNorm.includes(verifiedNorm) || verifiedNorm.includes(inputNorm)) {
    return { matches: true, score: 0.9, isFraud: false };
  }

  // Multi-name check
  const inputParts = input.toLowerCase().trim().split(/\s+/);
  for (const ip of inputParts) {
    for (const vp of verifiedParts) {
      if (ip === vp || vp.startsWith(ip) || ip.startsWith(vp)) {
        return { matches: true, score: 0.85, isFraud: false };
      }
    }
  }

  // Levenshtein distance
  const levenshtein = (a: string, b: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] =
          b[i - 1] === a[j - 1]
            ? matrix[i - 1][j - 1]
            : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    return matrix[b.length][a.length];
  };

  const maxLen = Math.max(inputNorm.length, verifiedNorm.length);
  const distance = levenshtein(inputNorm, verifiedNorm);
  const score = 1 - distance / maxLen;

  if (score >= 0.6) return { matches: true, score, isFraud: false };
  const isFraud = score < 0.3;
  return { matches: false, score, isFraud };
}

// ── Home Affairs Verification Service ────────────────────────────────

const HOME_AFFAIRS_SERVICE_URL =
  'https://home-affairs-service-867203198671.africa-south1.run.app';

export async function verifyWithHomeAffairs(
  idNumber: string,
  idToken: string
): Promise<{
  success: boolean;
  error?: string;
  verification?: { firstName: string; lastName: string };
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${HOME_AFFAIRS_SERVICE_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ idNumber }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const result = await response.json();
    if (result.success) {
      return { success: true, verification: result.verification };
    }
    return { success: false, error: result.error || 'Verification failed' };
  } catch (err) {
    console.error('[verification] Home Affairs error:', err);
    return { success: false, error: 'Failed to contact verification service' };
  }
}
