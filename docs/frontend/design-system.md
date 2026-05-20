# Design System

## 1. Design Direction

VideoAI should look like a modern AI productivity dashboard:

- Clear and calm.
- High trust.
- Fast to scan.
- Suitable for repeated work.
- Visual enough for media workflows.
- Not decorative or marketing-heavy inside the app.

Use a polished SaaS dashboard style with restrained color, strong spacing discipline and clear status indicators.

## 2. Design Tokens

Define tokens in Tailwind CSS using CSS variables.

Core token groups:

- Backgrounds.
- Foregrounds.
- Borders.
- Muted surfaces.
- Primary action color.
- Success/warning/error colors.
- Focus ring.
- Radius.
- Shadows.
- Chart colors.

Recommended palette:

- Base background: neutral white or near-white.
- Main text: neutral dark.
- Muted text: neutral gray.
- Primary accent: blue or cyan.
- Success: green.
- Warning: amber.
- Error: red.
- AI highlight: subtle cyan/blue tint, not full-page gradients.

Do not make the entire UI dominated by purple, blue gradients, beige, dark slate or orange/brown palettes.

## 3. Typography

Recommended:

- Use `Inter`, `Geist Sans` or the default Next.js Geist font.
- Use tabular numbers for metrics and latency values.
- Keep dashboard headings compact.

Guidelines:

- Page title: 24-32px.
- Section heading: 16-20px.
- Card/table text: 13-15px.
- Metadata and helper text: 12-13px.
- Do not scale font sizes with viewport width.
- Do not use negative letter spacing.

## 4. Layout

Use application shells:

- Public shell for home/login.
- User dashboard shell.
- Admin dashboard shell.

Dashboard structure:

- Sidebar for primary navigation.
- Top bar for breadcrumbs, project context, user menu and theme toggle.
- Main content region with constrained width where needed.
- Full-width work surfaces for prompt editor, upload preview and AI logs.

Avoid cards inside cards. Use cards for repeated items, stat summaries, dialogs and specific framed tools only.

## 5. Components

Use consistent component categories:

- Navigation: Sidebar, Breadcrumb, Tabs.
- Actions: Button, IconButton, Dropdown Menu.
- Forms: Input, Textarea, Select, Switch, Checkbox, Slider if needed.
- Feedback: Toast, Alert, Progress, Skeleton.
- Data: Table, Badge, Chart, Detail Drawer.
- Media: Dropzone, Preview Grid, Video Preview, File Status Row.

Use Lucide icons in buttons when an icon exists for the action.

Button variants:

- `primary`: blue filled for main actions such as Create, Save, Generate and Analyze.
- `secondary`: white/outline for supporting actions such as Edit, Set default, Prompt, Request, Response and Back.
- `destructive`: red filled for explicit delete/archive actions.
- `ghost`: neutral icon-only or low-emphasis actions.

Master prompt surfaces:

- Visible master prompt editors use a subtle cyan/blue wrapper with a cyan border.
- The textarea itself stays readable with a white or very light cyan background, cyan border/focus ring and monospace text.
- Ordinary story/script/schema/final output textareas remain on the neutral form surface.

## 6. Status Language

Use stable status labels:

- Draft
- Uploaded
- Validating
- Ready
- Queued
- Processing
- Succeeded
- Failed
- Cancelled

Status color rules:

- Neutral: draft, queued.
- Blue/cyan: processing.
- Green: succeeded.
- Amber: warning or partial.
- Red: failed.

## 7. Dark Mode

Dark mode can be supported after the first light theme is stable.

Rules:

- Do not rely on color alone.
- Keep contrast high.
- Keep media preview controls visible.
- Ensure table borders and selected rows remain legible.

## 8. Accessibility

Baseline requirements:

- All interactive controls must be keyboard reachable.
- Focus states must be visible.
- Icon-only buttons need accessible labels and tooltips.
- Dialogs and sheets must trap focus correctly.
- Form fields need labels and error messages.
- Tables need accessible column labels.
- Upload controls need keyboard and screen-reader equivalents.

Use Radix/shadcn primitives instead of hand-rolled complex controls.
