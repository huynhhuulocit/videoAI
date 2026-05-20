# VideoAI UI Patterns

## Screen Archetypes

| Screen | Layout | Primary Components | Required States |
| --- | --- | --- | --- |
| User dashboard | Sidebar shell, header action, project list, active jobs | `ProjectTable`, `CreateProjectDialog`, `JobProgress`, `StatusBadge` | Empty projects, loading list, create error |
| Project workspace | Project header, tabs, activity panel | `ProjectTabs`, `ProjectActivityList`, `GenerationActionBar` | Loading project, not found, forbidden |
| Script flow | Editor, media upload, generated prompt panel | `PromptEditor`, `FileDropzone`, `MediaPreviewGrid`, `GeneratedPromptPanel` | Empty input, uploading, generating, failed, succeeded |
| Product flow | Product URL input, upload, analysis output, prompt editor | `ProductUrlInput`, `MediaInsightsPanel`, `ProductFactsPanel`, `GeneratedProductPromptPanel` | Invalid URL, upload error, analyzing, failed, succeeded |
| Admin AI config | Config cards and audit summary | `ContentModeToggle`, `ProviderSelect`, `ModelSelect`, `SecretInput`, `ApiKeyStatus` | Missing config, saving, saved, save failed |
| Admin AI logs | Dense table, filters, detail drawer | `AIRequestLogTable`, `AIRequestLogFilters`, `AIRequestLogDetailDrawer`, `JsonPayloadViewer` | Empty logs, loading filters, failed query, redacted values |

## Layout Patterns

### Dashboard Shell

- Use persistent sidebar on desktop.
- Use sheet navigation on mobile.
- Keep page header compact.
- Place primary action in header right.
- Keep breadcrumbs visible for nested project/admin pages.

### Workflow Surface

- Keep input and output visible together on desktop.
- Stack input, media and output on mobile.
- Use an action footer or sticky action row for final actions.
- Make the current admin content mode visible when it affects available actions.

### Admin Data Table

- Put filters above the table.
- Use status badges and provider/model columns.
- Use a drawer for detail payloads.
- Do not render large JSON payloads inside table rows.
- Keep request IDs copyable.

## Component Selection Rules

- Use shadcn/ui primitives first.
- Wrap generic primitives into VideoAI-specific components once a pattern appears twice.
- Use Lucide icons for navigation and action buttons.
- Use Recharts only for compact dashboard summaries.
- Use Motion only for subtle state transitions.

## State Checklist

For every workflow screen, include:

- Loading state.
- Empty state.
- Error state.
- Disabled state.
- Pending mutation state.
- Success confirmation.
- Retry or recovery action when practical.

For upload screens, include:

- File type validation.
- Size validation.
- Duration validation for video.
- Per-file upload progress.
- Per-file remove action.
- Preview rendering.

For admin screens, include:

- Role-protected access.
- Audit-friendly copy.
- Secret redaction.
- Clear save result.
