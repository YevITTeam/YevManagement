export type PasswordOptions = {
    length: number;
    upper: boolean;
    lower: boolean;
    digits: boolean;
    symbols: boolean;
    excludeAmbiguous: boolean;
};

export type PasswordStrength = {
    level: 0 | 1 | 2 | 3 | 4;
    label: string;
    entropyBits: number;
    meetsComplexity: boolean;
};

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

// Quotes, backslash, backtick, <> and space are left out: they break when typed into scripts, CMD or a BIOS prompt.
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/";
const AMBIGUOUS = /[Il1O0o]/g;

function charSets(options: PasswordOptions): string[] {
    const sets = [
        options.upper ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : "",
        options.lower ? "abcdefghijklmnopqrstuvwxyz" : "",
        options.digits ? "0123456789" : "",
        options.symbols ? SYMBOLS : "",
    ];
    return sets.map((set) => (options.excludeAmbiguous ? set.replace(AMBIGUOUS, "") : set)).filter(Boolean);
}

// Rejection sampling keeps every index equally likely; a plain modulo would favour the low indices.
function randomIndex(max: number): number {
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    const buffer = new Uint32Array(1);
    do crypto.getRandomValues(buffer);
    while (buffer[0] >= limit);
    return buffer[0] % max;
}

export function generatePassword(options: PasswordOptions): string {
    const sets = charSets(options);
    if (sets.length === 0) return "";
    const length = Math.min(PASSWORD_MAX_LENGTH, Math.max(PASSWORD_MIN_LENGTH, options.length));
    const pool = sets.join("");
    // One character from every chosen set first, so the result always passes the complexity rule.
    const chars = sets.map((set) => set[randomIndex(set.length)]);
    while (chars.length < length) chars.push(pool[randomIndex(pool.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
}

const LEVELS = ["Rất yếu", "Yếu", "Trung bình", "Mạnh", "Rất mạnh"] as const;

// Entropy of a random password = length x log2(pool); bands follow the common 28/36/60/128-bit scale.
// Complexity = at least 3 of the 4 character classes and 8+ characters (the common Windows/AD policy).
export function passwordStrength(password: string, options: PasswordOptions): PasswordStrength {
    const pool = charSets(options).join("").length;
    const entropyBits = pool > 1 ? Math.round(password.length * Math.log2(pool)) : 0;
    const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
    const meetsComplexity = password.length >= PASSWORD_MIN_LENGTH && classes >= 3;
    let level: PasswordStrength["level"] = entropyBits < 28 ? 0 : entropyBits < 36 ? 1 : entropyBits < 60 ? 2 : entropyBits < 128 ? 3 : 4;
    // A short password stays weak however large the pool is (NIST SP 800-63B minimum is 8).
    if (password.length < 12) level = Math.min(level, 2) as PasswordStrength["level"];
    return { level, label: LEVELS[level], entropyBits, meetsComplexity };
}
