---
name: ate-ui-verification
description: ATE-specific UI verification for teacher-mobile and leadership-desktop surfaces, including accessibility, loading/error/offline states, visual regression and design-system consistency.
---

# ATE UI Verification

Use this skill after any meaningful UI change and before calling a UI task complete.

## 1. Product lens

ATE is institutional academic software. Visual quality must improve clarity, trust and speed of work.

Do not accept a screen merely because it compiles or resembles a reference image.

## 2. Teacher-mobile verification

Check at:
- 360 px;
- 390 px;
- 430 px.

Verify:
- primary action is obvious;
- next-class context is visible without excessive scrolling;
- no horizontal overflow;
- no desktop table squeezed into mobile;
- touch targets are usable;
- bottom navigation/sheets do not cover actions;
- long topic/outcome names wrap cleanly;
- offline/pending state is understandable;
- outcome recording remains fast.

## 3. Leadership verification

Check at:
- 1280 px;
- 1440 px;
- 1600 px.

Verify:
- attention is directed to exceptions/actions;
- dense data remains scannable;
- filters and action controls remain available;
- tables do not dominate when a simple list/summary works;
- no teacher-ranking implication;
- high-resolution teacher detail is not exposed unnecessarily.

## 4. State coverage

Every affected surface must be checked for:
- loading;
- empty;
- error;
- success;
- long content;
- permission denied where relevant;
- unavailable AI/provider;
- offline/degraded state where relevant.

## 5. Accessibility

Check:
- semantic headings/landmarks;
- visible focus;
- keyboard navigation;
- form labels;
- error association;
- contrast;
- reduced motion;
- no color-only status;
- useful accessible names for icon-only buttons.

## 6. Design-system consistency

Reject:
- arbitrary radius/spacing;
- one-off colors;
- nested cards without hierarchy need;
- decorative gradients/glow;
- random pills;
- inconsistent provenance/status treatment;
- page-specific component copies that should be shared.

## 7. Motion

Motion must explain:
- continuity;
- reveal;
- state change;
- confirmation.

Do not add animation simply because a skill suggests it.

## 8. Browser/visual workflow

Where available:
1. run the dev server;
2. open the affected route in a browser;
3. capture target widths;
4. inspect console errors;
5. exercise the full interaction;
6. compare with visual baseline;
7. fix material issues;
8. rerun.

## 9. Completion report

Report:
- routes reviewed;
- widths reviewed;
- states reviewed;
- accessibility issues fixed/outstanding;
- screenshots/baselines updated;
- any intentional visual deviation from DESIGN.md.
