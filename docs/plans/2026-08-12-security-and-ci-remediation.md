# boltcard-wallet — security and CI remediation plan

**Date:** 2026-08-12
**Scope:** `boltcard/boltcard-wallet` (fork of `BlueWallet/BlueWallet`)
**Origin:** fallout from an audit for CVE-2026-71851 ("Ill Bloom"). That audit found
this repo **not** exposed, but surfaced four unrelated items along the way.

---

## Status summary

| # | Item | Severity | State |
|---|------|----------|-------|
| 1 | CI dead — deprecated actions | blocker | **PR #31 open**, fix verified working |
| 2 | CI dead — `npm install` fails building git dep | blocker | diagnosed, not started |
| 3 | crypto-js 4.1.1 → 4.2.0 (CVE-2023-46233) | low | **PR #30 open** |
| 4 | Wallet-at-rest KDF is MD5/1-iteration | **high** | designed to decision point, not started |
| 5 | `getRealm()` unsalted SHA-256 + hardcoded key | medium | diagnosed, not started |
| 6 | crypto-js discontinued upstream | low | no action proposed |

Recommended order: **1 → 2 → 3 → 4 (with 5 folded in)**. Items 1 and 2 come first
because nothing else can be test-gated until CI runs.

---

## 1. CI: deprecated actions — PR #31 (open)

### Problem
Every job in both workflows failed before executing a single step:

```
##[error]This request has been automatically failed because it uses a deprecated
version of `actions/cache: v2` ... `actions/upload-artifact: v2`
```

The service APIs behind cache v1/v2 and artifact v1/v2 are shut down, so these are
hard failures. No PR to this repo could go green.

### Change
Version bumps only, no logic changes:

| Action | From | To | Count |
|---|---|---|---|
| `actions/cache` | `v2` | `v4` | 5 |
| `actions/upload-artifact` | `v2` | `v4` | 2 |
| `actions/setup-node` | `v2-beta` | `v4` | 3 |

`node-version` deliberately left at 16 — this is about action versions, not the
toolchain.

### Verification
Confirmed working. On the PR branch the deprecation error count is **0** across all
three jobs; checkout, setup-node and all five cache steps now run clean. Jobs proceed
to `Install node_modules`, which is item 2.

upload-artifact v4 breaking changes were checked before merging: artifact names
(`apk`, `e2e-test-videos`) are unique within their runs, and `if-no-files-found`
still defaults to the non-fatal `warn`.

### Recommendation
**Merge as-is.** It is a strict prerequisite — item 2 is invisible without it.

---

## 2. CI: `npm install` fails preparing the `rn-ldk` git dependency

### Problem
With item 1 cleared, all three jobs now fail at the same step:

```
npm ERR! git dep preparation failed
npm ERR! > rn-ldk@0.8.4 prepare
npm ERR! > bob build
npm ERR! ℹ Generating type definitions with tsc
npm ERR! node_modules/@types/node/ffi.d.ts:94:21 - error TS1139: Type parameter declaration expected.
npm ERR!    function dlopen<const T extends FunctionDefinitions = {}>(
```

### Root cause
`rn-ldk` is a git dependency (`github:BlueWallet/rn-ldk#v0.8.4`), so npm builds it
from source on every install, running `bob build` → `tsc`. That compile resolves a
floating `@types/node`, which now ships an `ffi.d.ts` using **`const` type
parameters** — a TypeScript 5.0+ feature. This repo is on `typescript@^4.8.4` with no
`overrides` or `resolutions`, so tsc cannot parse it.

Pure dependency drift: nothing in the repo changed, the ecosystem moved. It would have
started failing around the TS 5.0 release, but was masked by item 1.

### Options

**Option A — pin `@types/node` (recommended).**
Add an `overrides` entry constraining `@types/node` to a major that predates
`ffi.d.ts` (`^18` or `^20`). Smallest, most targeted, reversible, does not touch the
compiler.
*Risk:* an override is global to the tree; verify nothing else needs newer node types.

**Option B — bump `typescript` past 5.0.**
Fixes the whole class of problem rather than this instance.
*Risk:* a compiler bump on a React Native codebase this old can cascade into many type
errors; much larger blast radius for a CI repair.

**Option C — stop building the git dependency.**
Move to a published `rn-ldk` release if one exists, removing source builds from every
install.
*Risk:* depends on upstream publishing; largest change; may not be available.

**Recommendation: A**, then revisit B on its own merits later. A is provably scoped
and reversible; B is a toolchain migration wearing a CI fix's clothing.

### Definition of done
`npm install` succeeds on macOS CI, and the `test` job reaches and runs `npm test`.
Note that a *passing* suite is not assumed — see "Expectations" below.

---

## 3. crypto-js 4.1.1 → 4.2.0 — PR #30 (open)

Clears [CVE-2023-46233](https://github.com/advisories/GHSA-46rf-rjw5-3qc4) (CVSS 9.1),
where `PBKDF2` defaults to SHA1 with a single iteration.

**Runtime impact: none.** Nothing in this repo calls `CryptoJS.PBKDF2`.

**Verified safe for existing users.** `blue_modules/encryption.js` calls
`AES.encrypt(data, passwordString)`, which routes through OpenSSL `EvpKDF`, not
PBKDF2. `aes.js` and `evpkdf.js` are byte-identical between 4.1.1 and 4.2.0, and the
back-compat assertion in `tests/unit/encryption.test.js` (decrypting a
CryptoJS@3.1.9-1 ciphertext) was run against both versions and passes on each.

`package-lock.json` was edited in place rather than regenerated: a full
`npm install --package-lock-only` drops the local `blue_modules/bc-bech32` entry and
rewrites the project version `0.1.8 → 0.3.3`, neither of which belongs in a security
bump.

**Needs a rebase or merge from master** once item 1 lands, to pick up working
workflows.

**Not related to Ill Bloom.** CVE-2026-71851 affects `crypto-js < 4.0.0` only; this
repo has always been on 4.x and was never exposed.

---

## 4. Wallet-at-rest key derivation is MD5 with one iteration

### Problem
`blue_modules/encryption.js` is what encrypts wallet storage:

```js
const ciphertext = CryptoJS.AES.encrypt(data, password);
```

Passing a **string** password invokes OpenSSL `EvpKDF` — **MD5, 1 iteration, 8-byte
salt**. Password guessing against a stolen storage blob therefore costs roughly one
MD5 per attempt. No crypto-js version changes this; the item 3 bump does not help.

Second defect in the same module: **no authentication**. `decrypt()` detects failure
with a `str.length < 10` heuristic, and the existing comment concedes that decryption
"sometimes would succeed with incorrect password and return random couple of
characters."

### Decisions already taken

1. **Fork-only, stay mergeable with upstream BlueWallet.** Favours a versioned wrapper
   and additive changes over a rewrite; keep diffs out of files upstream churns.
2. **Drop plausible-deniability / decoy-bucket support** from this fork. Removes the
   constraint that migrated and unmigrated buckets stay indistinguishable.
3. **Existing multi-bucket users: detect and block migration.** If storage holds more
   than one bucket at unlock, leave it entirely on v1 and prompt the user to move funds
   out of the second bucket first. Chosen because `createFakeStorage` starts the duress
   bucket empty but users are expected to add real wallets to it — silent discard could
   destroy funds.

### Options (not yet chosen)

**Option A — versioned envelope: scrypt + AES-256-CBC + HMAC-SHA256 (recommended).**

```
encrypt(data, pw)  -> always v2
decrypt(data, pw)  -> dispatch on prefix
    "U2FsdGVkX1" -> legacy EvpKDF path (read-only)
    "BCW2."      -> scrypt + HMAC path

v2 envelope: "BCW2." + base64( salt[16] | iv[16] | ct | mac[32] )
    dk     = scrypt(pw, salt, N=2^15, r=8, p=1, dkLen=64)
    encKey = dk[0..32]   macKey = dk[32..64]
    ct     = AES-256-CBC(encKey, iv, plaintext)
    mac    = HMAC-SHA256(macKey, salt|iv|ct)
```

Fixes both defects at once. Encrypt-then-MAC replaces the `str.length < 10` guess with
a definitive MAC check. Reuses the existing native scrypt path (see below), so cost is
roughly 100–300 ms rather than seconds.

**Option B — keystore-wrapped data key.** Random 256-bit key in
`react-native-keychain` with hardware backing, password wrapping it via scrypt.
Strongest against offline guessing because the hardware rate-limits. But it breaks the
portable encrypted-blob model, complicates backup/restore, and puts a large diff
through `class/app-storage.js` — the file upstream churns most, conflicting with
decision 1.

**Option C — explicit PBKDF2 parameters.** Replace implicit EvpKDF with
`CryptoJS.PBKDF2(password, salt, {iterations: 250000, hasher: SHA256})`. Smallest diff,
but pure-JS PBKDF2 janks the RN thread on low-end Android, PBKDF2 is memory-cheap so
GPU attackers parallelise it far better than scrypt, and it still leaves the missing
MAC unaddressed.

### Building blocks already in this repo
- `blue_modules/aezeed/src/cipherseed.js` — `scryptWrapper()` gives native scrypt via
  `react-native-blue-crypto` with a `scryptsy` JS fallback; self-tested in
  `screen/selftest.js`.
- `class/app-storage.js:openRealmKeyValue()` — the correct
  Keychain-stored-random-key pattern, if option B is chosen.

### Consumers to update
`class/app-storage.js` and `screen/selftest.js` are the only callers of
`blue_modules/encryption.js`.

---

## 5. `getRealm()` derives its key with unsalted SHA-256

In `class/app-storage.js`:

```js
const password = this.hashIt(this.cachedPassword || 'fyegjitkyf[eqjnc.lf');
const buf = Buffer.from(this.hashIt(password) + this.hashIt(password), 'hex');
```

`hashIt` is a bare `createHash('sha256')`. Two consequences:

- The Realm key is **unsalted SHA-256, two or three rounds** — a faster guessing target
  than item 4, and unsalted means one precomputation works against every user.
- When no storage password is set (the default), the key derives from a **hardcoded
  string present in the source**, reused at `blue_modules/BlueElectrum.js:26`.

**Severity: medium, not high.** This Realm holds transaction metadata and addresses, so
it is a privacy exposure rather than direct fund loss — seeds live in the separate
encrypted `data` blob.

`openRealmKeyValue()` a few lines away already does this correctly with a random
64-byte key in Keychain, so the fix pattern exists in-file. Fold into item 4.

---

## 6. crypto-js is discontinued upstream

The package is unmaintained; npm carries a deprecation notice and the last publish was
three years ago. This repo uses it for NTAG424 DNA card authentication (`class/Ntag424.js`,
`utils/Cmac.js`) and, until item 4 lands, wallet-at-rest encryption.

No live CVE against 4.2.0. Recording it because the next advisory against crypto-js
will have no upstream fix. Migrating to the native crypto API is real work, not a bump.
**No action proposed now.**

---

## Expectations

Items 1 and 2 make CI *able to run*. They do not imply the suite passes. This repo has
had no working test gate for a considerable period — item 1 predates item 2, which
itself predates TS 5.0 — so genuine failures may have accumulated underneath both. Treat
the first green-ish run as discovery, and fix what it surfaces separately rather than
folding it into either CI PR.

## Explicitly verified clean

- **Not exposed to CVE-2026-71851 ("Ill Bloom").** That advisory affects
  `crypto-js < 4.0.0`; this repo has always been on 4.x.
- `class/Ntag424.js` references `CryptoJS.lib.WordArray` — the symbol named in the
  advisory — but uses `.init()` to build word arrays for an XOR, **not** `.random()`.
  No seed or key entropy in this wallet comes from crypto-js.

## Out of scope

This plan covers one audit thread plus what it happened to surface. It is **not** a
security review of this repo. Items 4 and 5 were found only because they sit in files
opened for other reasons; no systematic review of the wallet, its key handling, or its
network code has been performed.
