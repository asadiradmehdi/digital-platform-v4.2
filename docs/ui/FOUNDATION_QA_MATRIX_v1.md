# UI Foundation QA Matrix v1

This matrix is mandatory before the UI Foundation stage can become GREEN.

## Typography
- [ ] Vazirmatn variable font is bundled and actually loaded.
- [ ] Inter variable font is bundled and actually loaded.
- [ ] Persian headings/body text use Vazirmatn.
- [ ] Latin identifiers/model names use Inter.
- [ ] Numeric values use tabular numerals where alignment matters.
- [ ] Persian digits and Latin digits render without reordering.
- [ ] Currency amount + currency label remain visually coherent.
- [ ] Mixed strings (`Claude Sonnet`, `GPT-5.6`, `AI Writer Pro`) remain stable inside RTL text.
- [ ] Order IDs, URLs, API keys and email addresses remain LTR-isolated.

## Responsive
- [ ] 360px mobile viewport.
- [ ] 390px mobile viewport.
- [ ] 768px tablet viewport.
- [ ] 1024px desktop viewport.
- [ ] 1440px desktop viewport.
- [ ] 1920px wide viewport.
- [ ] No horizontal scrolling except intentionally scrollable controls.
- [ ] Mobile bottom navigation respects safe-area inset.

## States
- [ ] Loading.
- [ ] Empty.
- [ ] Error + retry.
- [ ] Success.
- [ ] Disabled controls.
- [ ] Focus-visible keyboard state.
- [ ] Reduced-motion preference.

## Accessibility
- [ ] Every icon-only control has an accessible name.
- [ ] Buttons have explicit `type` when nested in forms.
- [ ] Form fields have labels.
- [ ] Interactive elements are keyboard reachable.
- [ ] Status is not conveyed by color alone.
- [ ] Focus indicators remain visible.

## Browser QA
- [ ] Chromium desktop.
- [ ] Chromium mobile.
- [ ] Firefox desktop.
- [ ] WebKit desktop.
- [ ] No console errors on core routes.
- [ ] No failed font/network requests caused by the application.
