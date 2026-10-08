# ASCII Aesthetic Proposal — cukt.click

**Status:** Mockup / Proposal Only  
**Date:** October 8, 2026  
**Author:** Cloud Agent

---

## License Verdict

The bas3line/ascii repository is licensed under the **MIT License** (Copyright © 2026 bas3line).

**Requirements:**
- "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software."
- This means if we use the library code, we must include the MIT license text and copyright notice.

**Verdict:** ✅ **The library is safe to use.** The MIT license is permissive and allows commercial use, modification, and distribution. Attribution is required only if we copy substantial portions of the code.

---

## Recommended Approach

**Use the `ascii.rest` npm package for production.**

### Why This Approach?

1. **Clean Integration**: The package has an Astro component (`ascii.rest/astro`) that server-renders the first frame, then animates client-side. Perfect for cukt.click's static site.

2. **No External API Dependency**: Import pieces as ES modules, bundle them with the site. No runtime dependency on ascii.rest servers.

3. **Small Bundle**: Text pieces are tiny (~1-2 KB each). Colored pieces (scenes, logos) are larger but lazy-loaded.

4. **MIT Licensed**: Permissive, requires only attribution in source code.

5. **Mobile-Optimized**: Works on small screens, respects `prefers-reduced-motion`, accessible.

### For This Mockup

The mockups use a **simple canvas-based ASCII renderer** written from scratch to avoid adding dependencies during the proposal phase. The production version should use `ascii.rest` for better quality and maintainability.

---

## What Rolling It Out Would Take

### Option A: All Agent Rooms

**Scope:**
- Convert portrait images to ASCII art using the library or canvas renderer
- Add ASCII box-drawing frames around sections
- Add terminal-style stats (STATUS, MEMORY, SESSIONS, UPTIME)
- Preserve existing chat functionality
- Keep mobile responsive (≥375px width, ≥16px body text, ≥44px tap targets)

**Estimate:**
- **Agent work:** 3-4 hours
  - Update agent room template (`/agents/[id].astro`)
  - Test on all 7 agent rooms
  - Verify accessibility (screen readers, keyboard nav, contrast)
  - Verify mobile usability (iPhone 13/14/15 sizes)
  - Performance check (Lighthouse mobile score)
- **Review:** 1 hour (Piotr to review aesthetic, usability, consistency)

**Files Changed:**
- `src/pages/agents/[id].astro` — main template
- `src/styles/global.css` — possibly add `.ascii-box` utility
- `package.json` — add `ascii.rest` if using the library

---

### Option B: All Project Cards

**Scope:**
- Add ASCII ornaments (box-drawing `╔═══╗` frames) to project cards
- Style tags and status badges with terminal look
- Add subtle hover effects (scan line, glitch)
- Keep cards responsive and readable
- Apply to project listing pages (`/personal`, `/archive`, home page cards)

**Estimate:**
- **Agent work:** 2-3 hours
  - Update project card component or template
  - Test on project listing pages
  - Verify grid layout doesn't break
  - Mobile responsive check
  - Lighthouse score check
- **Review:** 1 hour

**Files Changed:**
- `src/styles/global.css` — update `.project-card` styles
- Possibly `src/components/ProjectCard.astro` if one exists
- Templates that render project grids

---

### Both Options (Agent Rooms + Project Cards)

**Total Estimate:**
- **Agent work:** 5-7 hours
- **Review:** 2 hours
- **Total:** 7-9 hours

---

## Risks

### 1. Performance on Mobile

**Risk:** ASCII rendering (especially canvas-based) can be CPU-intensive on older phones.

**Mitigation:**
- Use static pre-rendered ASCII where possible
- Lazy-load ASCII art (render on scroll or interaction)
- Respect `prefers-reduced-motion` (show static first frame only)
- Test on real devices (iPhone 13, Pixel 7)
- Set performance budget: Lighthouse mobile score ≥85

### 2. Accessibility

**Risk:** ASCII art is decorative noise for screen readers.

**Mitigation:**
- Use `aria-hidden="true"` on ASCII art elements
- Provide real alt text for portraits (e.g., "Portrait of Wiktoria Cukt 2.0")
- Ensure all text content is readable by screen readers
- Verify with VoiceOver (macOS/iOS) and NVDA (Windows)
- Maintain WCAG AA contrast ratios (4.5:1 for body text)

### 3. Maintenance

**Risk:** Custom ASCII renderer could drift from the site's design system. The ascii.rest library could break in future versions.

**Mitigation:**
- **If using custom renderer:** Document the algorithm, keep it simple, make it reusable
- **If using ascii.rest:** Pin the version (`ascii.rest@^0.2.1`), test upgrades in staging
- Add visual regression tests (Percy, Chromatic, or manual screenshots)

### 4. Consistency with Existing Design

**Risk:** ASCII aesthetic might clash with other pages (Technopera, Habeas Mentem, archive pages) that use a cleaner brutalist style.

**Mitigation:**
- **Isolated rollout:** Apply ASCII only to agent rooms first, get feedback
- **Shared vocabulary:** Keep monospace typography, red/white/green palette, border style consistent
- **Hybrid approach:** Use ASCII ornaments (box-drawing) without full ASCII portraits if the full aesthetic is too much

### 5. Cross-Browser Compatibility

**Risk:** Box-drawing characters (`─ │ ╭ ╰`) render inconsistently across browsers/OSes. Android often lacks monospace glyphs.

**Mitigation:**
- ascii.rest bundles a 3 KB cut of JetBrains Mono with only the needed glyphs, loaded only on browsers that lack them
- Test on Chrome, Firefox, Safari (macOS/iOS), Edge (Windows), Chrome (Android)
- Fallback to simple borders if glyphs are missing

---

## Open Questions for Piotr

1. **How aggressive should the aesthetic be?**
   - Full ASCII portrait rendering (as in mockup)?
   - ASCII ornaments only (box-drawing frames, no portrait conversion)?
   - Hybrid (ASCII frames + subtle scan-line animation on original photos)?

2. **Agent rooms only, or project cards too?**
   - Start with agent rooms and expand if it works?
   - Or do both at once?

3. **Should the ASCII aesthetic extend to other sections?**
   - Archive pages?
   - About page?
   - Navigation?

4. **Animation preferences?**
   - Scan-line animation on portraits (as in mockup)?
   - Glitch effect on hover (as in mockup)?
   - Static only (respect `prefers-reduced-motion` universally)?

5. **Should portraits be real ASCII art or "ASCII-styled" (pixelated, monochrome, but not character-based)?**
   - True ASCII (characters like `@ # * . -`) — harder to read, more authentic terminal aesthetic
   - Styled photo (keep photo, add ASCII frame/overlay) — cleaner, easier to recognize faces

6. **Performance budget?**
   - Target Lighthouse mobile score?
   - Max acceptable bundle size increase?
   - Should ASCII art lazy-load (render on scroll)?

---

## Next Steps

1. **Piotr reviews the mockups:**
   - `/mockups/ascii-agent-room/` (Wiktoria Cukt 2.0)
   - `/mockups/ascii-project-card/` (Technopera + grid)
   - Screenshots: see `/opt/cursor/artifacts/screenshots/`

2. **Piotr answers open questions** (listed above)

3. **If approved:**
   - Agent implements chosen variant (agent rooms, project cards, or both)
   - Test on staging (if available) or local preview
   - Piotr reviews live
   - Merge to `main` (triggers Render deploy)

4. **If not approved:**
   - Adjust aesthetic based on feedback
   - Create new mockup iteration
   - Repeat

---

## Artifacts

All screenshots and this document are saved in:

- `/opt/cursor/artifacts/screenshots/ascii-agent-room-iphone.png` (390×844)
- `/opt/cursor/artifacts/screenshots/ascii-agent-room-desktop.png` (1440×900)
- `/opt/cursor/artifacts/screenshots/ascii-project-card-iphone.png` (390×844)
- `/opt/cursor/artifacts/screenshots/ascii-project-card-desktop.png` (1440×900)
- `/opt/cursor/artifacts/screenshots/original-agent-room-iphone.png` (390×844, before/after)
- `/opt/cursor/artifacts/ascii-proposal.md` (this document)

---

**End of Proposal**
