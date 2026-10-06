# Waste Segregation Monitoring — 5-Minute Demo Script

Follow this step-by-step script for a demonstration of the frontline waste segregation monitoring app.

---

## Before You Present Checklist

1. Run `npm run demo:reset` from the project root to ensure a clean database state with rich 60-day historical compliance and violation data for the dashboard.
2. (Optional) Open `http://localhost:5173/worker/labels` and print or keep a label visible on another screen.
3. Ensure both servers are running (`npm run dev`), or start the production build via `npm run start:prod` on `http://localhost:5000`.
4. If demonstrating on a phone via `npm --prefix client run dev:https`, ensure camera permissions are allowed and your phone is charged.

---

## 5-Minute Demo Walkthrough

### Step 1: Open Home Launcher
- **Action**: Navigate to `http://localhost:5173/`.
- **What to say**: *"This is the landing launcher for the Waste Segregation Monitoring platform. It provides direct, role-based access for frontline collection workers, municipal households, and ULB administrative staff with zero clutter."*

### Step 2: Citizen Registers a Household
- **Action**: Click **"Open citizen view"** (navigates to `/citizen`). Switch to the **"Register my household"** tab.
- **Action**: Fill in:
  - Full Name: `Siddharth Verma`
  - Mobile Number: `9876543210`
  - Address: `Flat 4B, Emerald Heights, Egmore`
  - Ward: `Ward 1 - Central (W01)`
  - Check the consent checkbox.
  - Click **"Register household"**.
- **Action**: Show the registration success screen displaying the unique household QR code (e.g., `HH-W01-006` or `HH-W01-007`). Click **"Download QR"**.
- **What to say**: *"Households self-register in seconds. The generated QR card can be printed or stuck onto their waste bins. The initial eco-points balance starts at zero."*

### Step 3: Worker Signs In & Logs Segregated Waste
- **Action**: In an incognito tab or separate window, open `http://localhost:5173/login`.
- **Action**: In dev mode, click **"Worker"** under quick accounts (or type `worker@demo.in` / `Demo@1234`), then click **"Sign in"**.
- **Action**: On the **Scan** tab, type the newly registered code (e.g., `HH-W01-006`) into the manual input and press Enter.
- **Action**: Once the household card appears, tap the large green **"Segregated"** button.
- **What to say**: *"Frontline workers have an ultra-fast, high-contrast interface designed for outdoor use. Notice that there is no mention of points anywhere on this screen—worker compensation is strictly operational."*

### Step 4: Offline Scenario Demonstration
- **Action**: In the worker browser window, open DevTools -> **Network** tab -> Set throttling to **Offline** (or toggle device Wi-Fi off).
- **Action**: Look at the top status bar: the indicator updates to a red dot labeled **"Offline"**.
- **Action**: Enter the registered code again and log another **"Segregated"** pickup.
- **Action**: Enter `HH-W01-001` and log a **"Segregated"** pickup.
- **Action**: Switch to the **Queue** tab. Show the 2 pickups marked with **"Waiting to sync"**.
- **Action**: Switch the DevTools network back to **No throttling** (Online).
- **Action**: Within seconds, observe the queue auto-sync and empty itself, confirming successful backend upload.
- **What to say**: *"Network connectivity is often spotty in dense alleys. The app stores logs securely in client IndexedDB and automatically syncs when the worker steps back into cell coverage."*

### Step 5: Log a Rejected Pickup with a Reason
- **Action**: Back on the **Scan** tab, look up the registered household code.
- **Action**: Click **"Rejected"**. A bottom sheet modal appears prompting for a rejection reason.
- **Action**: Select **"Hazardous items in dry bin"** and tap **"Confirm rejection"**.
- **What to say**: *"When waste cannot be collected due to contamination, workers log the exact rejection reason. This generates actionable feedback directly for the citizen."*

### Step 6: Citizen Dashboard Verification
- **Action**: Switch back to the Citizen window (`/citizen`).
- **Action**: Click **"Check status"** or refresh the dashboard using the household code and last 4 digits (`3210`).
- **Action**: Point out:
  - **Eco-points**: Updated according to segregation rules (+10 per segregated collection).
  - **Pickups tab**: Shows the segregation history with timestamps and the rejected entry with the explicit reason.
  - **Messages tab**: Displays an unread indicator dot and in-app notifications explaining why waste was rejected or points awarded.
  - **Streak & Bonus**: Highlights consecutive segregation progress toward streak bonuses.
- **What to say**: *"Citizens receive immediate transparency into their waste collection history, motivating proper segregation through positive reinforcement."*

### Step 7: ULB View (Staff Dashboard)
- **Action**: In your staff window, navigate to `http://localhost:5173/login`.
- **Action**: Click **"Admin"** under quick accounts (or sign in as `admin@demo.in` / `Demo@1234`).
- **What to say**: *"Now we step into the shoes of the municipal administration on the ULB Staff Dashboard. Notice that, like the worker view, this dashboard strictly focuses on operational compliance—no citizen points are shown here."*
- **Action**: Point to the **Summary Cards** and **Ward Comparison** section.
- **What to say**: *"At a glance, the Urban Local Body sees overall segregation compliance rates, total collections, and a side-by-side comparison between wards. Ward 1 shows steady improvement, while Ward 2 is clearly struggling under 40% compliance."*
- **Action**: Scroll to the **Repeat Offenders (Hotspots)** table.
- **What to say**: *"The Hotspots table highlights chronic non-compliant households ranked by violation frequency, showing their ward and most common violation reason. This lets supervisors target door-to-door awareness campaigns where they are needed most."*
- **Action**: Scroll to the **Compliance Trend** chart and toggle between **Day** and **Week** view, then examine the **Ward Compliance Heatmap**.
- **What to say**: *"This custom SVG line chart visualizes compliance trends over time. Below it, the heatmap matrix reveals week-by-week performance across wards, making chronic drops in segregation immediately apparent."*
- **Action**: Click **"Export CSV"** in the top action bar and open the downloaded CSV file.
- **What to say**: *"With a single click, staff can export standardized Swachh Bharat Mission (SBM) compliant CSV reports containing all filtered pickup metrics for state-level reporting."*
- **Action**: Click the user profile / logout button (or clear session), return to `/login`, and sign in as **Supervisor** (`supervisor@demo.in` / `Demo@1234`).
- **Action**: Show that the top heading now displays **"ULB dashboard - Your Ward"** and the data is strictly scoped to Ward 1 without the cross-ward dropdown.
- **What to say**: *"Role-scoping is enforced both in the UI and at the API level. Ward supervisors only see data and export CSVs for their own assigned ward, maintaining data boundaries while empowering localized operations."*

---

## If Something Goes Wrong

- **Camera does not open**: Use the manual code entry input field present on the Scan tab.
- **Worker shows "Network Error" on login**: Ensure the Express server is running on port 5000 (`npm --prefix server run dev`).
- **Citizen says "Household not found"**: Ensure you typed the exact last 4 digits used during registration.
- **Dashboard has no trends or hotspots**: Ensure you seeded with history data by running `npm run demo:reset`.
- **Reset database immediately**: Run `npm run demo:reset` from the project root.
