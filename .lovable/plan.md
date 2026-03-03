

# Plan: Role "Balance" + Pre-balance System

## Summary

Add a new employee role **"balance"** with a pre-balance (preliminary balance) system. The accountant (buhgalter/admin) tops up pre-balances; a "balance" role employee transfers funds from pre-balance to main balance with full audit logging.

---

## Concept

```text
Accountant tops up  -->  Pre-balance (per driver, per currency)
                              |
Balance employee  -->  Transfer from pre-balance --> Main balance
                       (logged: from whom, to whom, amount, currency)
```

- **Drivers** see only their main balance (no change)
- **Admin** sees both pre-balances and main balances
- **Balance role** sees pre-balances, main balances, expenses (read-only, no add/edit/delete/export), NO drivers page

---

## Changes

### 1. Types (`src/types/index.ts`)
- Extend `UserRole` to `"admin" | "driver" | "balance"`
- Add `preBalances: Record<Currency, number>` to `User` interface
- Add `TransferRecord` interface: `{ id, fromDriverId, toDriverId, currency, amount, date, performedBy }`

### 2. Google Apps Script (backend) -- provided separately
- New sheet **"PreBalances"**: `userId, KZT, RUB, UZS, CNY, EUR` (same structure as Balances)
- New sheet **"Transfers"**: `id, fromDriverId, toDriverId, currency, amount, date, performedBy`
- New actions:
  - `getPreBalance(userId)` -- get pre-balances
  - `updatePreBalance(targetUserId, currency, newAmount)` -- admin tops up pre-balance
  - `transfer(fromDriverId, toDriverId, currency, amount, performedBy)` -- subtract from pre-balance, add to main balance, log
  - `getTransfers()` -- get transfer history
- Modify `getDrivers` to include `preBalances`
- Modify top-up logic: when admin does "Popolnenie" it goes to pre-balance instead of main balance

### 3. API service (`src/services/api.ts`)
- Add methods: `getPreBalance`, `updatePreBalance`, `transfer`, `getTransfers`
- Update `normalizeUser` to include `preBalances`

### 4. Auth & Routing (`src/App.tsx`)
- Add routing block for `user.role === "balance"`:
  - `/balance` -- dashboard with pre-balances and main balances
  - `/balance/expenses` -- expenses (read-only)
  - `/balance/transfers` -- transfer page
  - `/profile`
- No access to `/admin/drivers`

### 5. Bottom Navigation (`src/components/BottomNav.tsx`)
- Add `balanceTabs` array for the balance role:
  - Balances page, Expenses page, Transfers page

### 6. New Pages

**`src/pages/balance/BalanceDashboard.tsx`**
- Shows all drivers in a dropdown
- For each driver: main balance cards + pre-balance cards (separate sections)
- No editing capability

**`src/pages/balance/BalanceTransfers.tsx`**
- Transfer form: select source driver (pre-balance), select target driver (main balance), select currency, enter amount
- Shows available pre-balance for selected source driver/currency
- Transfer button calls `api.transfer()`
- Transfer history list below the form

**`src/pages/balance/BalanceExpenses.tsx`**
- Reuse the expense list UI from AdminExpenses but:
  - No "Add" button
  - No edit/delete buttons on cards
  - No Excel export button
  - Filters remain functional (driver, category, date range)

### 7. Admin Dashboard (`src/pages/admin/AdminDashboard.tsx`)
- Add a second section showing pre-balances per driver (below the main balance cards)
- Label: "Предварительный баланс"

### 8. Admin Expenses top-up logic (`src/pages/admin/AdminExpenses.tsx`)
- When admin does "Popolnenie", call `updatePreBalance` instead of `updateBalance`
- This ensures top-ups go to pre-balance, not main balance

### 9. Admin Drivers filter
- In `AdminDrivers.tsx`, filter out "balance" role users alongside "admin" (they're not drivers)

---

## Technical Details

### GAS new functions (to be provided separately after approval):
- `getPreBalancesForUser(userId)` -- mirrors `getBalancesForUser` but reads "PreBalances" sheet
- `updatePreBalance(body)` -- mirrors `updateBalance` but writes to "PreBalances"
- `transfer(body)` -- validates pre-balance sufficient, subtracts from PreBalances, adds to Balances, logs to Transfers sheet
- `getTransfers(body)` -- returns all transfers

### New Google Sheets:
- **PreBalances**: `userId | KZT | RUB | UZS | CNY | EUR`
- **Transfers**: `id | fromDriverId | toDriverId | currency | amount | date | performedBy`

### File changes summary:
| File | Change |
|------|--------|
| `src/types/index.ts` | Add "balance" role, `preBalances`, `TransferRecord` |
| `src/services/api.ts` | Add 4 new methods, update normalizeUser |
| `src/App.tsx` | Add balance role routing |
| `src/components/BottomNav.tsx` | Add balance role tabs |
| `src/pages/balance/BalanceDashboard.tsx` | New file |
| `src/pages/balance/BalanceTransfers.tsx` | New file |
| `src/pages/balance/BalanceExpenses.tsx` | New file |
| `src/pages/admin/AdminDashboard.tsx` | Show pre-balances section |
| `src/pages/admin/AdminExpenses.tsx` | Top-up writes to pre-balance |
| `src/pages/admin/AdminDrivers.tsx` | Filter out "balance" role |

