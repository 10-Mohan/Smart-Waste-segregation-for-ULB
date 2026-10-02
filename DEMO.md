# Waste Segregation Monitoring — 5-Minute Demo Script

Follow this step-by-step script for a demonstration of the frontline waste segregation monitoring app.

---

## Before You Present Checklist

1. Run `npm run demo:reset` from the project root to ensure a clean database state.
2. (Optional) Open `http://localhost:5173/worker/labels` and print or keep a label visible on another screen.
3. Ensure both servers are running (`npm run dev`).
4. If demonstrating on a phone via `npm --prefix client run dev:https`, ensure camera permissions are allowed and your phone is charged.

---

## 5-Minute Demo Walkthrough

### Step 1: Open Home Launcher
- **Action**: Navigate to `http://localhost:5173/`.
- **What to say**: *"This is the landing launcher for the Waste Segregation Monitoring platform. It provides direct, role-based access for frontline collection workers and municipal citizens with zero administrative clutter."*

### Step 2: Citizen Registers a Household
- **Action**: Click **"Citizen Portal"** (navigates to `/citizen`). Switch to the **"Register my household"** tab.
- **Action**: Fill in:
  - Full Name: `Siddharth Verma`
  - Mobile Number: `9876543210`
  - Address: `Flat 4B, Emerald Heights, Egmore`
  - Ward: `Ward 1 - Central (W01)`
  - Check the consent checkbox.
  - Click **"Register household"**.
- **Action**: Show the registration success screen displaying the unique household QR code (e.g., `HH-W01-006`). Click **"Download QR card"**.
- **What to say**: *"Households self-register in seconds. The generated QR card can be printed or stuck onto their waste bins. The initial eco-points balance starts at zero."*

### Step 3: Worker Signs In & Logs Segregated Waste
- **Action**: In an incognito tab or separate window, open `http://localhost:5173/login`.
- **Action**: Click **"Use account"** for Demo Worker (`worker@demo.in` / `Demo@1234`), then click **"Sign in"**.
- **Action**: On the **Scan** tab, type the newly registered code `HH-W01-006` into the manual input and press Enter.
- **Action**: Once the household card appears, tap the large green **"Segregated"** button.
- **What to say**: *"Frontline workers have an ultra-fast, high-contrast interface designed for outdoor use. Notice that there is no mention of points anywhere on this screen—worker compensation is strictly operational."*

### Step 4: Offline Scenario Demonstration
- **Action**: In the worker browser window, open DevTools -> **Network** tab -> Set throttling to **Offline** (or toggle device Wi-Fi off).
- **Action**: Look at the top status bar: the indicator updates to a red dot labeled **"Offline"**.
- **Action**: Enter `HH-W01-006` again and log another **"Segregated"** pickup.
- **Action**: Enter `HH-W01-001` and log a **"Segregated"** pickup.
- **Action**: Switch to the **Queue** tab. Show the 2 pickups marked with **"Waiting to sync"**.
- **Action**: Switch the DevTools network back to **No throttling** (Online).
- **Action**: Within seconds, observe the queue auto-sync and empty itself, confirming successful backend upload.
- **What to say**: *"Network connectivity is often spotty in dense alleys. The app stores logs securely in client IndexedDB and automatically syncs when the worker steps back into cell coverage."*

### Step 5: Log a Rejected Pickup with a Reason
- **Action**: Back on the **Scan** tab, look up `HH-W01-006`.
- **Action**: Click **"Rejected"**. A bottom modal appears prompting for a rejection reason.
- **Action**: Select **"Hazardous items in dry bin"** and tap **"Confirm rejection"**.
- **What to say**: *"When waste cannot be collected due to contamination, workers log the exact rejection reason. This generates actionable feedback directly for the citizen."*

### Step 6: Citizen Dashboard Verification
- **Action**: Switch back to the Citizen window (`/citizen`).
- **Action**: Click **"Refresh"** on the dashboard.
- **Action**: Point out:
  - **Eco-points**: Updated according to segregation rules.
  - **Pickups tab**: Shows the segregation history and the rejected entry with the explicit reason.
  - **Messages tab**: Displays an unread indicator dot and in-app notifications explaining why waste was rejected or points awarded.
  - **Streak & Bonus**: Highlights consecutive segregation progress.
- **What to say**: *"Citizens receive immediate transparency into their waste collection history, motivating proper segregation through positive reinforcement."*

---

## If Something Goes Wrong

- **Camera does not open**: Use the manual code entry input field present on the Scan tab.
- **Worker shows "Network Error" on login**: Ensure the Express server is running on port 5000 (`npm --prefix server run dev`).
- **Citizen says "Household not found"**: Ensure you typed the exact last 4 digits used during registration.
- **Reset database immediately**: Run `npm run demo:reset` from the project root.
