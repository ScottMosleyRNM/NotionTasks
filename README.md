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

### 1. Create a public connection in Notion

Notion now calls OAuth apps **public connections** (formerly "public integrations"). See Notion's [Public connections](https://developers.notion.com/guides/get-started/public-connections) and [Authorization](https://developers.notion.com/guides/get-started/authorization) guides for the current screens.

1. Open Notion's **Developer portal** and go to **Build → Public connections**, then create a new one. You may need to be a workspace owner.
2. Choose the **installation scope**: *any workspace*, or *selected workspaces only* if this is just for your team. **This can't be changed later.**
3. Under the OAuth settings, add the **Redirect URI** `https://<your-domain>/api/auth/callback`. It must match exactly: no trailing slash, wildcards or fragments. For local development, also add `http://localhost:3000/api/auth/callback` if Notion accepts it; some setups require HTTPS.
4. Under **capabilities**, enable read, update and insert content. Also enable reading user information (used to show creator names).
5. Notion may also ask for listing details such as a name, icon, website, privacy policy, terms of use and support email. Fill in whatever it requires; none of it affects how the app works.
6. Open the connection's **Configuration** tab and copy the **OAuth client ID** and **OAuth client secret**. **The secret may only be revealed once**, so save it right away.

### 2. Environment variables

| Variable | Required | Notes |
| -------- | -------- | ----- |
| `NOTION_OAUTH_CLIENT_ID` | yes | From the public connection's Configuration tab |
| `NOTION_OAUTH_CLIENT_SECRET` | yes | From the public connection's Configuration tab |
| `SESSION_SECRET` | yes | Random string, 32+ characters. Encrypts the session cookie. Generate with `openssl rand -base64 48` |
| `NOTION_REDIRECT_URI` | recommended | Must exactly match a redirect URI on the public connection. Defaults to `<current origin>/api/auth/callback` |

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
