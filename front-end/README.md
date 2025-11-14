# EMBR3 HR PMS Front-End (React + Vite)

## Overview

This front-end is built with React 18 and Vite 7, using Ant Design 5 for UI components. It communicates with the EMBR3 HR PMS Node/Express backend and provides modules for employee management, DTR, payslip generation, backups, and administrative settings.

## Key Features

- Modular employee records (General Info, DTR, Trainings, Payslip Generation)  
- Secure encrypted storage for sensitive client-side data (tokens, user info, preferences, notifications)  
- Dynamic payslip PDF generation (Regular & Contract variants) with email sending workflow  
- Resigned employee cascade delete & record aggregation  
- Biometric logs filtering, pagination, export (CSV), and time-of-day filters  
- Backup job management with enriched Requested By attribution  
- Environment-driven position acronym substitution in payslips  
- Compact table styling across modules (System Reports, Payroll Signatories, Payslip lists)
- Deterministic Tag colors for sections/units via shared utility

## Secure Client Storage

All persistent values in `localStorage` are automatically encrypted using AES-256 with per-item random IVs via the utility `utils/secureStorage.js`.

### How It Works

| Aspect | Details |
| ------ | ------- |
| Algorithm | AES (CryptoJS) with random 16-byte IV per entry |
| Key | SHA-256 hash of `VITE_ENCRYPT_SECRET` (first 32 hex chars used as key) |
| Format | `ss:<ivHex>:<ciphertext>` for localStorage; `ssess:<ivHex>:<ciphertext>` for sessionStorage |
| Auto-Migration | On module load, any plaintext entries are transparently encrypted in place |
| Helpers | `secureStore`, `secureGet`, `secureRemove`, `secureHardenAll`, `listSecureKeys` |
| Session Support | Mirrored API: `secureSessionStore`, `secureSessionGet`, etc. |

### Required Environment Variable

Define a strong secret in your front-end environment:

```
VITE_ENCRYPT_SECRET="<long-random-32+char-secret>"
```

Never commit production secrets. Use `.env.local` or deployment platform secret injection.

### Usage Examples

```js
import { secureStore, secureGet } from '../utils/secureStorage';

secureStore('user', { id: 'E-001', name: 'Alice' });
const user = secureGet('user');
```

For session-scoped ephemeral data:

```js
import { secureSessionStore, secureSessionGet } from '../utils/secureStorage';

secureSessionStore('tempFilters', { dateFrom: '2025-11-01' });
const filters = secureSessionGet('tempFilters');
```

### Auditing
## UI Conventions

### Compact Tables

- Add `className="compact-table"` to Ant Design `Table` components (and optionally to parent containers) to reduce row padding and font size for dense data views.
- Standard pagination config:
	- `size="small"`
	- `pagination={{ showSizeChanger: true, pageSizeOptions: [5, 10, 20, 50, 100], defaultPageSize: 10 }}`
- Used in: System Reports, Payroll Signatories, Payslip employee lists, and diagnostic tables.

### Tag Colors

- Use the shared utility `src/utils/tagColors.js` to keep tag colors stable app‑wide.
- API:
	- `pickTagColor(value: string): string` — deterministic palette selection based on hash
	- `buildColorMapFromList(list: string[]): Record<string,string>` — assign colors by index to a known ordered list
	- `TAG_COLOR_PALETTE: string[]` — default palette
- Example:

```js
import { pickTagColor } from "../src/utils/tagColors";
<Tag color={pickTagColor(sectionOrUnit)}>{sectionOrUnit}</Tag>
```


You can quickly inspect which keys are encrypted:

```js
import { listSecureKeys } from '../utils/secureStorage';
console.table(listSecureKeys());
```

## Developer Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint (JS/React rules) |

## Payslip Generation

Utilities in `utils/generatePaySlipRegular.js` and `utils/generatePaySlipContract.js` render PDF payslips using jsPDF and Autotable. Generation supports:

- Inline preview (data URI) with hidden toolbar  
- New tab view & download  
- Email sending (server endpoint attaches generated PDF)  

## Position Acronym Mapping

Set `VITE_POSITION_ACRONYMS` to a JSON string mapping long titles to acronyms, e.g.:

```json
{"Project Evaluation Officer I": "PEO I", "Administrative Aide VI": "AA VI"}
```

Used in payslip rendering to shorten the Designation line.

## Resigned Employee Handling

- Aggregates related records (DTR logs, Payslip requests, Docs, Notifications, Trainings) for summary before cascade delete.
- Emp No resequencing fills numbering gaps automatically.

## Biometric Logs Enhancements

- Time-of-day filters (HH:mm range)  
- Pagination with meta: total, hasMore, pageSize  
- CSV export of filtered result set  
- Accurate employee matching via normalized Emp ID & name token strategy.

## Backup Jobs

Backup UI reorganized for compact display; `requestedByName` enriched from auth middleware for clarity and audit consistency.

## Environment Variables Summary

| Variable | Purpose |
| -------- | ------- |
| `VITE_API_URL` | Backend base URL (falls back to `/api`) |
| `VITE_ENCRYPT_SECRET` | Encryption key material (mandatory for secure storage) |
| `VITE_POSITION_ACRONYMS` | JSON mapping of long position titles to acronyms |

## Contributing

1. Ensure a strong `VITE_ENCRYPT_SECRET` locally.  
2. Run `npm run dev` for iterative changes.  
3. Keep storage additions going through `secureStore` / `secureSessionStore`.  
4. For new sensitive keys, avoid plaintext `localStorage.setItem` entirely.

## Future Improvements

- Key rotation helper: decrypt using old key → re-encrypt using new key.  
- Optional WebCrypto implementation for native crypto instead of CryptoJS.  
- Integrate a UI admin panel for viewing encrypted key metadata.

---
This README supersedes the default Vite template content and documents current security & feature architecture.
