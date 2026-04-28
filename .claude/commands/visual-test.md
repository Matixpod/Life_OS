---
description: Full visual audit of the Life OS dashboard using Playwright
---

Perform a complete visual test of Life OS:

1. Confirm frontend is running on localhost:5173 (if not, start it with `cd frontend && pnpm dev`)
2. Open localhost:5173 via Playwright MCP
3. Take a desktop screenshot (1440px width) → save to screenshots/desktop-dashboard.png
4. Resize to 375px, take mobile screenshot → save to screenshots/mobile-dashboard.png  
5. Check browser console for any JS errors — report all errors found
6. Click each of the 12 module cards and verify navigation works (no 404s, no crashes)
7. Navigate back to / after each click
8. Check the morning popup: does it appear on first load? Does it have all 4 inputs?
9. Navigate to /cognitive — is the timer visible? Does the "Start Timer" button work?
10. Navigate to /intelligence — does content load or show an appropriate empty state?

Report:
- ✅ What looks correct
- ⚠️ Visual issues (alignment, color, font, sizing)
- ❌ Broken functionality or JS errors
- 📱 Mobile layout issues

Fix all ❌ issues before marking the current phase complete.
