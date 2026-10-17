# Tasks for Notion

A calm, Things 3–style view of the tasks assigned to you across any number of Notion databases. Works on iPhone, iPad and desktop.

- **Sign in with Notion.** Each user signs in with their own Notion account and picks which databases to share. No database IDs are hardcoded.
- **Choose task databases.** After signing in, pick the databases that hold tasks. Each one can be limited to tasks assigned to you.
- **Lists:** Today (due today or overdue), Upcoming (by day, then by month), Anytime (no due date), Logbook (recently completed), and one list per database.
- **Task details.** Tap a task to expand it in place: notes, the database's own properties, status, due date, assignees, creator, and a button that opens the task in the Notion app.

## How it decides what each property is

Any Notion database works. The app finds the roles by property type and name:

| Role     | Looks for |
| -------- | --------- |
| Title    | The database's title property |
| Status   | A `status` property, else a select named Status/State/Stage, else a checkbox named Done/Complete |
| Due date | A date property named Due/Deadline/Date, else the first date property |
| Assignee | A people property named Assignee/Owner/Responsible/People, else the first people property |

"Complete" means the options in the status property's **Complete** group (or names like Done/Complete for select properties).

## Setup

### 1. Create a public Notion integration

1. Go to <https://www.notion.so/profile/integrations> → **New integration**.
2. Set **Type** to **Public**.
3. Under **Capabilities**, enable *Read content*, *Update content*, *Insert content*, and *Read user information including email addresses* (used to show creator names).
4. Add the OAuth **Redirect URI**: `https://<your-domain>/api/auth/callback`. For local development, also add `http://localhost:3000/api/auth/callback`.
5. Copy the **OAuth client ID** and **OAuth client secret**.

### 2. Environment variables

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NOTION_OAUTH_CLIENT_ID` | yes | From the integration |
| `NOTION_OAUTH_CLIENT_SECRET` | yes | From the integration |
| `SESSION_SECRET` | yes | Random string, 32+ characters. Encrypts the session cookie. Generate with `openssl rand -base64 48` |
| `NOTION_REDIRECT_URI` | recommended | Must exactly match a redirect URI on the integration. Defaults to `<current origin>/api/auth/callback` |

The older `NOTION_TOKEN`, `NOTION_DATABASE_ALLOWLIST`, `NOTION_INBOX_DATABASE_ID`, `NOTION_DEFAULT_ASSIGNEE_ID` and `NOTION_DATABASE_LABELS_JSON` variables are no longer used.

### 3. Run

```bash
npm install
npm run dev
```

## How sessions work

There is no app database. The user's Notion access token and their database choices are stored in one AES-GCM encrypted, http-only cookie. The token never reaches the browser. Each device signs in once, and signing out clears the cookie.

## Keyboard shortcuts (desktop)

- `N`: new task
- `/`: Quick Find
- `Esc`: close a task or search
