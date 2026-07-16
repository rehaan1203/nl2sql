# Agent Rules

## Always Require User Approval
- **Rule**: Irrespective of whether the task is a major architectural change or a minor bug fix, you MUST always create an `implementation_plan.md` artifact and set `RequestFeedback=True` to explicitly seek the user's approval before modifying any code.
- **Why**: The user has explicitly requested to always have the Accept/Reject buttons available before any changes are applied to the codebase.

## Data Presentation Guidelines
- **Table Column Headings**: Always ensure database column headings in UI components are displayed in an UPPERCASE style using CSS (e.g., Tailwind's uppercase tracking-wider classes). Never hardcode the string manipulation directly into the data variables. Allow the data to retain its original format from the backend, but apply uppercase styling purely on the frontend presentation layer.
