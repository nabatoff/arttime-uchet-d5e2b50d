

# Logistics PWA — Implementation Plan

## Design System
- **Pure Black (#000000)** background throughout the app
- **Vibrant Red (#FF0000)** for buttons, accents, active states
- **White/Light Gray** text for readability
- Mobile-first design, professional look
- PWA setup with installability, offline support, and proper manifest

## Authentication & Session Management
- Login screen with Login/Password fields styled in the dark theme
- Store session in localStorage with role info (Admin/Driver)
- On every app launch, verify the stored password against the API — force logout if password has changed
- Role-based routing: Drivers see driver pages, Admins see admin pages

## Driver Experience

### Bottom Navigation Bar
- **Баланс** (Dashboard) | **Расходы** (Expenses) | **Пробег** (Mileage) | **Профиль** (Profile)

### Dashboard — "Мой баланс"
- Currency balance cards shown dynamically based on the driver's `availableCurrencies` string
- Support for KZT, RUB, UZS, CNY, EUR with appropriate currency formatting
- Clean card layout with currency icons/flags

### Expenses — "Расходы"
- List of expenses from the last 3 days
- Each entry shows: date, category, amount, currency, comment
- "Edit" button enabled only for today's records; older records are read-only
- **Add Expense Form**: Category dropdown (fetched from API), Amount, Currency, Comment, Receipt Photo (mandatory)
- Photo uploaded to ImgBB first; "Save" button disabled until ImgBB URL is received

### Mileage — "Отчет по пробегу"
- Form with numeric KM input and mandatory speedometer photo
- Photo uploaded to ImgBB before submission
- History of submitted mileage reports

## Admin Experience

### Driver Carousel
- Horizontal swipeable list of all drivers at the top of the admin view
- Tapping a driver selects them for detail views below

### Admin Dashboard
- View selected driver's balances across all currencies
- **Currency toggles**: 5 toggle switches (KZT, RUB, UZS, CNY, EUR) per driver, saved as comma-separated string
- **Balance adjustment**: Manually update any driver's balance in any currency

### Global Mileage Feed
- Vertical scrollable list of all mileage reports from all drivers
- Card design: Left side has rounded driver photo, name, and date; Right side has large bold blue KM value with vertical separator

## API Integration Layer
- Central `api.ts` service module handling all POST requests to the Google Apps Script Web App URL
- Action-based request pattern (e.g., `{ action: "login", ... }`)
- Endpoints: login, getAppData, getBalance, getExpenses, addExpense, updateExpense, addMileage, getMileage, updateDriverCurrencies, updateBalance, getDrivers
- ImgBB upload utility function

## PWA Configuration
- Install `vite-plugin-pwa` with proper manifest (app name, icons, theme color)
- Mobile-optimized meta tags
- Service worker with navigateFallbackDenylist for OAuth routes

## All UI text in Russian

