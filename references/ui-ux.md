# Visual and journey review

Use this rubric with the product's audience, brand and design system. Label heuristic judgment separately from measurable failure. Inspect screenshots yourself; producing PNGs is not a visual review.

## Coverage sample

List page templates, main goal and primary tasks. Typical widths: 375 CSS px mobile, 768 tablet and 1440 desktop; use supported breakpoints when known. Check reflow at a 320 CSS px equivalent and browser zoom at 200% where possible. Resizing alone does not reproduce text-only zoom or real mobile behavior. Check orientation, dark theme and localization/RTL when supported.

For each journey record entry point, goal, steps, expected/observed result, input mode, device, evidence and untested states. Use test accounts/synthetic data. Examples: find item → inspect details → select; fill form → error → correct → confirm in test mode; menu → destination → Back. An untested production submission is not a proven broken form.

## UI lenses

| Lens | Inspect |
| --- | --- |
| Hierarchy | Clear purpose and next action, grouped related content, meaningful headings |
| Typography | Readable actual sizes, coherent scale/weight, useful line measure, long/localized text fits |
| Spacing/alignment | Consistent component relationships/tokens; report consequences, not arbitrary pixel preferences |
| Color | Supported themes are readable; status is not color-only; measured contrast when claiming failure |
| Components | Clear affordances and hover/focus/active/disabled/error states without disruptive layout changes |
| Responsive | Unintended overflow, clipped labels, obscured controls, unusable tables, sticky-layer collisions |
| Media/content | Useful crop/resolution/alternatives, reserved loading space, clear and accurate copy |
| Motion | Purposeful feedback, reduced motion, essential content remains available |

Capture URL, viewport, state and screenshot for each visual claim. Verify overflow candidates: carousels and hidden off-canvas menus can be intentional. Preserve intentional style instead of making every site share one aesthetic.

## UX lenses

- Navigation: labels match destinations, location is clear, search/filter behavior is understandable, URL/history preserve context, mobile actions remain reachable.
- Feedback/control: loading/success/failure differ; long tasks communicate progress; retries, double submission, cancel and back behave predictably.
- Forms: persistent labels, input types/autocomplete, clear required fields, associated errors, retained valid input, explicit consent and confirmation.
- Resilience: empty/no-results, slow/unavailable network, expired session, denied permissions, API failure and long content. Simulate safely in test/local environments.
- Trust: accurate CTA labels, clear cost/commitment, consistent terms, no misleading disabled actions or irreversible surprises.
- Mobile: usable menus/modals, touch spacing, virtual keyboard clearance, no hover-only functions.

A heuristic walkthrough identifies friction; it cannot establish conversion gains or representative preferences. For uncertain high-impact choices, state the hypothesis that user testing should resolve.

## Accessibility: automation plus manual

Consult [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/); do not infer conformance from a score.

- Keyboard: meaningful order, visible/unobscured focus, no trap, operable controls, appropriate Escape and focus restoration for overlays.
- Semantics: headings/landmarks, names/roles/states, labels, useful link text, page title and language; prefer native controls where appropriate.
- Contrast: normal text 4.5:1, large text 3:1, meaningful non-text UI 3:1 where applicable. Check actual computed foreground/background and exceptions.
- Resizing/reflow: essential content stays usable under applicable zoom/reflow conditions; distinguish legitimate two-dimensional content exceptions.
- Targets: AA criterion 2.5.8 uses 24×24 CSS px or sufficient spacing, with exceptions. 44×44 CSS px is the enhanced criterion and a useful usability target, not a universal AA minimum.
- Alternatives: image alternatives, captions/transcripts where applicable, non-color cues, reduced motion, no disabled browser zoom.
- Screen reader: test available reader/browser combinations when possible. Accessibility-tree inspection is useful but is not a screen-reader test.

axe `incomplete` means review needed, not pass. Map findings to WCAG only when justified. Avoid legal compliance conclusions.
