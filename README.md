# GitHub PR Activity Report Generator

A Node.js tool to generate comprehensive reports of GitHub pull request activity for users, including PRs created and reviewed during a specified time period.

## Features

- Generate reports for multiple users or a single user
- Customizable time periods (days, weeks, months, or custom date ranges)
- Track PRs created and reviewed
- Automatic benefit categorization from PR descriptions
- Filter by GitHub organization
- Export to formatted Markdown report
- Detailed metrics and statistics

## Prerequisites

- Node.js (v14 or higher)
- GitHub Personal Access Token

## Setup

1. **Clone or navigate to the project directory**

```bash
cd weeklyreport
```

2. **Install dependencies**

```bash
npm install
```

3. **Create a GitHub Personal Access Token**

   - Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Select scopes:
     - `repo` (required for accessing repository data)
     - `read:org` (optional, only if querying private repos or organization data)
   - Copy the generated token

4. **Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and add your GitHub token:

```
GITHUB_TOKEN=your_github_token_here
```

## Usage

### Basic Usage

Generate a report for all users in the `github_users` file for the last 7 days:

```bash
node generateReport.js
```

### Command Options

```bash
node generateReport.js [options]
```

#### Options:

- `-u, --users <users>` - Comma-separated list of GitHub usernames
- `-f, --file <path>` - Path to file containing GitHub usernames (default: `./github_users`)
- `-p, --period <period>` - Time period (default: `7d`)
  - `7d` - Last 7 days
  - `3w` - Last 3 weeks
  - `1m` - Last 1 month
  - `3m` - Last 3 months (quarter)
  - `YYYY-MM-DD..YYYY-MM-DD` - Custom date range
- `-o, --org <org>` - Filter by GitHub organization
- `--output <path>` - Output file path (default: `report.md`)

### Examples

**1. Report for users in github_users file (last 7 days)**
```bash
node generateReport.js
```

**2. Report for specific users (last 3 weeks)**
```bash
node generateReport.js -u "jan--f,marioferh,machine424" -p 3w
```

**3. Report for a single user (last month)**
```bash
node generateReport.js -u "octocat" -p 1m
```

**4. Report for users in custom file (last quarter)**
```bash
node generateReport.js -f ./my-team.txt -p 3m
```

**5. Report with custom date range**
```bash
node generateReport.js -p "2025-01-01..2025-01-31"
```

**6. Report filtered by organization**
```bash
node generateReport.js -o "kubernetes" -p 2w
```

**7. Custom output file**
```bash
node generateReport.js -p 1w --output weekly-summary.md
```

**8. Report for specific users in an organization**
```bash
node generateReport.js -u "user1,user2" -o "myorg" -p 1m --output org-monthly.md
```

## GitHub Users File Format

Create a `github_users` file with one GitHub username per line:

```
jan--f
marioferh
machine424
simonpasquier
slashpai
```

Lines that are empty or contain only whitespace will be ignored.

## Report Contents

The generated report includes:

### Executive Summary
- Total PRs created across all users
- Total PRs merged
- Total PRs reviewed
- Overall merge rate

### Per-User Sections
For each user, the report includes:

1. **Summary Statistics**
   - Number of PRs created (merged, open, closed)
   - Number of PRs reviewed

2. **Pull Requests Created**
   - Title and status (✅ merged, 🔄 open, ❌ closed)
   - Repository name
   - PR number with link
   - Creation and closure dates
   - Brief introduction (from PR description)
   - Automatically detected benefits:
     - Bug fix
     - Performance improvement
     - Security enhancement
     - New feature
     - Code quality improvement
     - Test coverage
     - Documentation

3. **Pull Requests Reviewed**
   - Grouped by repository
   - PR titles with links
   - Original authors

### Overall Impact & Benefits
- Summary of team activity and collaboration metrics

## Sample Output

```markdown
# GitHub Pull Request Activity Report

**Period:** 2025-01-01 to 2025-01-07
**Generated:** 2025-01-14

---

## Executive Summary

This report provides an overview of GitHub pull request activity for 10 contributor(s)...

### Key Metrics

- **Total PRs Created:** 45
- **Total PRs Merged:** 38
- **Total PRs Reviewed:** 67
- **Merge Rate:** 84.4%

---

## jan--f

### Summary

- **PRs Created:** 5
  - Merged: 4
  - Open: 1
  - Closed: 0
- **PRs Reviewed:** 8

### Pull Requests Created

#### 1. ✅ Fix memory leak in worker pool
...
```

## Troubleshooting

### Rate Limiting

GitHub API has rate limits. If you hit the limit:
- Authenticated requests: 5,000 requests/hour
- The script should handle most use cases within these limits
- For large teams or long periods, consider running in smaller batches

### No PRs Found

If no PRs are found:
- Verify the usernames are correct
- Check the time period is appropriate
- Ensure the GitHub token has proper permissions
- If filtering by organization, verify users have PRs in that org

### Authentication Errors

If you see authentication errors:
- Verify your `GITHUB_TOKEN` is set correctly in `.env`
- Ensure the token hasn't expired
- Check that the token has the required scopes

## License

ISC

## Contributing

Feel free to submit issues or pull requests to improve this tool.
