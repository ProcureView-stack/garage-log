# Garage Log

A dark-mode, iOS-style web app for tracking services, repairs, parts and invoices for your vehicles.
It installs to the iPhone home screen and runs full-screen and offline. All data stays on the phone.

## Features
- **Garage**: switch between vehicles, see the odometer, spend this year, upcoming reminders (overdue / due soon / OK) and recent activity.
- **Records**: Service, Repair, Parts Replacement, Tyres, Brakes, Battery, Inspection/Roadworthy, Licence Renewal, Insurance or Other. Each record holds the date, odometer, workshop, cost, an itemised parts & labour list, notes and next-due date/odometer, with quick presets such as "1 year" or "15 000 km".
- **Documents**: scan invoices with the camera or attach photos or PDFs. Each document gets a category and can be linked to a record.
- **History**: grouped by month, with a type filter and search across parts, part numbers, workshops and notes.
- **Backup**: export everything, documents included, to one `.json` file (save it to iCloud Drive/Files) and restore it on any device.

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
