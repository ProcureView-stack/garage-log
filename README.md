# Garage Log

A dark-mode, iOS-style web app for tracking services, repairs, parts and invoices for your vehicles.
It installs to the iPhone home screen and runs full-screen and offline. All data stays on the phone.

## Features
- **Garage**: switch between vehicles, see the odometer, spend this year, upcoming reminders (overdue / due soon / OK) and recent activity.
- **Vehicle photos**: take or choose photos of each vehicle. The cover photo heads the Garage card; tap it to open the gallery and change the cover.
- **Insurance**: per-vehicle policy details (insurer, cover type, policy no., premium and frequency, debit order day, start and renewal dates, insured value, excess, add-ons, claims and roadside numbers, policy documents). The renewal date appears in Upcoming.
- **Records**: Service, Repair, Parts Replacement, Tyres, Brakes, Battery, Inspection/Roadworthy, Licence Renewal, Insurance or Other. Each record holds the date, odometer, workshop, cost, an itemised parts & labour list, notes and next-due date/odometer, with quick presets such as "1 year" or "15 000 km".
- **Documents**: scan invoices with the camera or attach photos or PDFs. Each document gets a category and can be linked to a record.
- **History**: grouped by month, with a type filter and search across parts, part numbers, workshops and notes.
- **Trips**: start a trip at the current odometer, log fuel (with litres), toll gates, food, drinks, accommodation, parking, tips and car guards, entry fees and receipts along the way, then end it with the odometer reading. Each trip shows distance, cost per km, fuel use and a cost breakdown. The trip logbook exports as CSV (useful for a SARS travel logbook).
- **Spending**: tap "Spent" on the Garage card to choose This Year, Last 12 Months or All Time and see a breakdown of maintenance and trip costs.
- **Backup**: export everything, documents included, to one `.json` file (save it to iCloud Drive/Files) and restore it on any device.

## Releasing an update
1. Bump `APP_VERSION` in `app.js`, `version.json` and `CACHE` in `sw.js` to the same new number.
2. Add the changes to `WHATS_NEW` in `app.js`.
3. Commit and push to `main`. GitHub Pages redeploys within a minute or two.

Installed apps check `version.json` each time they come to the foreground. When the version is newer they show an "Update ready" banner. Updates only replace app files, never the data stored on the phone.

## Run locally
```powershell
python -m http.server 8765
```
Then open http://localhost:8765.

## Put it on your iPhone
The phone has to load the app over **HTTPS**. Any free static host works:

1. **Netlify Drop**: go to app.netlify.com/drop and drag this folder onto the page. You get an https link.
2. **GitHub Pages**: push this folder to a repository, then go to Settings → Pages → deploy from the `main` branch.

On the iPhone, open the link in **Safari**, tap **Share → Add to Home Screen**, then launch it from the icon.

> Data is saved inside the installed app on that phone. Use **Settings → Export Backup** regularly.

## Files
| File | Purpose |
|---|---|
| `index.html` | App shell and tab bar |
| `styles.css` | iOS dark-mode design system |
| `app.js` | All logic: IndexedDB storage, views, forms, scanning, reminders, backup |
| `sw.js` | Service worker for offline use |
| `manifest.webmanifest`, `icons/` | Install metadata and app icons |
