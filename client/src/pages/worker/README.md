# Worker View

Run the app on HTTPS for phone-camera access with `npm run dev:https`. Open the HTTPS network URL printed by Vite on the phone while it is on the same network; the browser may ask you to trust the local development certificate. Standard `npm run dev` remains available for local desktop testing.

The Worker view is split into Scan, Today, Queue, and Households tabs. Offline pickups are stored in IndexedDB and submitted through the pickup batch API when the connection returns.