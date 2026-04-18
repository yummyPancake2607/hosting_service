# CSS Import Guide

This document lists the CSS files that need to be imported in each component/page file.

## Automatic Imports (Global)
These are automatically imported through `main.jsx`:
- `index.css` - Global styles and CSS variables
- `utilities.css` - Utility classes (buttons, text, grids, etc.)
- `App.css` - Main app shell and navigation

## Component-Specific Imports

### Components

#### GameCard.jsx
```javascript
import '../styles/GameCard.css'
```
**Styles**: Game card grid items, images, overlays, buttons

#### NavBar.jsx
```javascript
// Already styled by App.css - no additional import needed
// Uses: .nav-bar, .nav-links, .nav-link, .nav-link.active
```

### Pages

#### HomePage.jsx
```javascript
import '../styles/HomePage.css'
```
**Styles**: Home hero section, features, build plan list

#### GameDetailsPage.jsx
```javascript
import '../styles/GameDetailsPage.css'
```
**Styles**: Game detail view, image section, metadata, action buttons

#### LibraryPage.jsx
```javascript
import '../styles/LibraryPage.css'
```
**Styles**: Library grid, filters, library items, search

#### ChatPage.jsx
```javascript
import '../styles/ChatPage.css'
```
**Styles**: Chat container, messages, input area, room list

#### LoginPage.jsx
```javascript
import '../styles/LoginPage.css'
```
**Styles**: Login form, social buttons, authentication UI

#### NotFoundPage.jsx
```javascript
import '../styles/NotFoundPage.css'
```
**Styles**: 404 error page, animations, buttons

## CSS File Summary

| File | Purpose | Size Impact | Load Time |
|------|---------|-------------|-----------|
| index.css | Root variables, global setup | ~3KB | Loaded immediately |
| App.css | Navigation, panels, shell | ~5KB | Loaded immediately |
| utilities.css | Reusable classes | ~4KB | Loaded immediately |
| GameCard.css | Game cards | ~4KB | Loaded on home/library |
| GameDetailsPage.css | Detail view | ~3KB | Loaded on detail page |
| LibraryPage.css | Library view | ~4KB | Loaded on library page |
| ChatPage.css | Chat interface | ~4KB | Loaded on chat page |
| HomePage.css | Home page | ~3KB | Loaded on home page |
| LoginPage.css | Login form | ~3KB | Loaded on login page |
| NotFoundPage.css | 404 page | ~2KB | Loaded on not found |

**Total CSS**: ~35KB (minified: ~14KB)

## Using CSS Variables

All components have access to CSS variables defined in `index.css`:

```css
/* Colors */
var(--cp-dark-bg)           /* #0a0e27 */
var(--cp-primary)           /* #00d9ff */
var(--cp-secondary)         /* #ff006e */
var(--cp-accent)            /* #b537f2 */
var(--cp-accent-alt)        /* #00ff41 */
var(--cp-text-primary)      /* #e8f4f8 */
var(--cp-text-secondary)    /* #a0c9d9 */
var(--cp-text-muted)        /* #6b8fa3 */
var(--cp-border)            /* #00d9ff */
var(--cp-border-subtle)     /* #1a3f5c */
```

### Example Usage in CSS:
```css
.my-element {
  color: var(--cp-primary);
  border: 1px solid var(--cp-border-subtle);
  background: rgba(0, 217, 255, 0.1);
}
```

## Shared Class Names

### Common Button Classes
```html
<!-- Primary Button -->
<button class="btn">Click Me</button>

<!-- Secondary Button -->
<button class="btn secondary">Click Me</button>

<!-- Danger Button -->
<button class="btn danger">Click Me</button>

<!-- Success Button -->
<button class="btn success">Click Me</button>
```

### Common Badge Classes
```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-secondary">Secondary</span>
<span class="badge badge-accent">Accent</span>
<span class="badge badge-success">Success</span>
```

### Grid Layout Classes
```html
<!-- Auto-responsive grid -->
<div class="grid-auto">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- 2-column grid -->
<div class="grid-2">
  <div>Left</div>
  <div>Right</div>
</div>

<!-- 3-column grid -->
<div class="grid-3">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>
```

## Best Practices

1. **Import early** - Import CSS at the top of component files
2. **Use variables** - Always use CSS variables for consistency
3. **Test responsive** - Check mobile/tablet/desktop views
4. **Keep specificity low** - Use simple class selectors
5. **Use utilities** - Leverage utility classes for common styling
6. **Avoid inline styles** - Put all styling in CSS files

## Troubleshooting

### Styles Not Applying?
1. Check import path is correct
2. Verify component class names match CSS
3. Check browser DevTools for CSS conflicts
4. Clear browser cache

### Colors Look Wrong?
1. Verify CSS variable name in `index.css`
2. Check if dark mode is enabled
3. Verify color contrast on your monitor

### Performance Issues?
1. Check file sizes in browser DevTools
2. Verify lazy-loading is working
3. Check for redundant CSS
4. Use CSS minification in production

---

**Last Updated**: 2024
**Cyberpunk Game Insights Theme v1.0**
