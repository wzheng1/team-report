# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Pull Request Activity Report Generator - a Node.js CLI tool that generates comprehensive reports of pull requests created and reviewed by GitHub users over customizable time periods.

## Purpose

The tool helps teams and individuals:
- Track PR activity across team members
- Generate weekly, monthly, or quarterly reports
- Analyze contribution patterns and code review participation
- Document team productivity and collaboration metrics

## Project Structure

```
weeklyreport/
├── generateReport.js      # Main report generation script
├── github_users           # Default user list (one username per line)
├── package.json          # Dependencies and npm scripts
├── .env                  # GitHub token (not in git, must be created)
├── .env.example          # Template for environment variables
├── README.md             # User documentation
└── CLAUDE.md             # This file - guidance for Claude Code
```

## Key Dependencies

- `@octokit/rest` - GitHub API client for fetching PR data
- `commander` - CLI argument parsing
- `dotenv` - Environment variable management

## Configuration

### Required Setup

1. **GitHub Personal Access Token** (required)
   - Create at: https://github.com/settings/tokens
   - Required scopes: `repo`, `read:org` (for private repos/org data)
   - Store in `.env` file:
     ```
     GITHUB_TOKEN=your_token_here
     ```

2. **User List** (optional)
   - Default file: `github_users`
   - Format: One GitHub username per line
   - Can also specify users via `-u` flag

## Common Usage Patterns

### Generate Reports

```bash
# Weekly report for users in github_users
npm run report:week
# or
node generateReport.js -p 7d

# 3-week report
npm run report:3weeks
# or
node generateReport.js -p 3w

# Monthly report
npm run report:month
# or
node generateReport.js -p 1m

# Quarterly report
npm run report:quarter
# or
node generateReport.js -p 3m

# Specific user(s)
node generateReport.js -u "username1,username2" -p 2w

# Custom date range
node generateReport.js -p "2025-01-01..2025-01-31"

# Filter by organization
node generateReport.js -o "kubernetes" -p 1m

# Custom output file
node generateReport.js -p 7d --output custom-report.md
```

## Development Commands

```bash
# Install dependencies
npm install

# Generate report (default: 7 days, users from github_users)
npm run report

# Convenience scripts
npm run report:week       # Last 7 days
npm run report:3weeks     # Last 3 weeks
npm run report:month      # Last 1 month
npm run report:quarter    # Last 3 months
```

## CLI Options

The `generateReport.js` script accepts:

- `-u, --users <users>` - Comma-separated GitHub usernames
- `-f, --file <path>` - Path to user list file (default: `./github_users`)
- `-p, --period <period>` - Time period:
  - `Xd` - X days (e.g., `7d`, `30d`)
  - `Xw` - X weeks (e.g., `1w`, `3w`)
  - `Xm` - X months (e.g., `1m`, `3m`)
  - `YYYY-MM-DD..YYYY-MM-DD` - Custom date range
- `-o, --org <org>` - Filter by GitHub organization
- `--output <path>` - Output file path (default: `report.md`)

## Report Contents

Generated reports include:

1. **Executive Summary**
   - Total PRs created, merged, reviewed
   - Overall merge rate percentage
   - Team activity overview

2. **Per-User Sections**
   - PRs created (with status: ✅ merged, 🔄 open, ❌ closed)
   - PRs reviewed (grouped by repository)
   - Each PR includes:
     - Title, number, clickable link
     - Repository name
     - Creation/closure dates
     - Brief introduction (from PR description)
     - Auto-detected benefits (bug fix, feature, performance, security, etc.)

3. **Overall Impact & Benefits**
   - Team collaboration metrics
   - Delivery and quality indicators

## Benefit Auto-Detection

The script automatically categorizes PRs based on keywords in descriptions:

- **Bug fix** - "fix", "bug"
- **Performance improvement** - "performance", "optimize"
- **Security enhancement** - "security", "vulnerability"
- **New feature** - "feature", "add"
- **Code quality improvement** - "refactor", "clean"
- **Test coverage** - "test", "coverage"
- **Documentation** - "doc", "readme"

## When Making Changes

### Adding New Features

If adding new functionality to the report generator:
- Update `generateReport.js` with new features
- Update `README.md` with usage examples
- Add corresponding npm scripts to `package.json` if appropriate
- Update this CLAUDE.md with any new patterns or usage

### Modifying Report Format

The report generation happens in the `generateReport()` function in `generateReport.js`. Key sections:
- Executive Summary (lines ~166-176)
- Per-User Reports (lines ~179-250)
- Overall Impact (lines ~253-259)

### GitHub API Considerations

- Rate limits: 5,000 requests/hour for authenticated requests
- The script uses GitHub Search API for PRs
- Search queries use filters: `author:`, `reviewed-by:`, `org:`, `is:pr`, `created:`

## Troubleshooting

### Common Issues

1. **No GITHUB_TOKEN**
   - Error: "GITHUB_TOKEN environment variable is not set"
   - Solution: Create `.env` file with valid GitHub token

2. **No PRs Found**
   - Check username spelling
   - Verify time period is appropriate
   - Ensure token has correct permissions
   - If using `-o`, verify users have PRs in that organization

3. **Rate Limiting**
   - GitHub allows 5,000 requests/hour
   - For large teams, consider running in smaller batches
   - Add delays between requests if needed

## Best Practices

1. **Regular Reports**
   - Run weekly reports for sprint retrospectives
   - Generate monthly/quarterly reports for performance reviews
   - Keep historical reports for trend analysis

2. **User Lists**
   - Maintain `github_users` file with your team members
   - Create separate files for different teams (`team-a.txt`, `team-b.txt`)

3. **Security**
   - Never commit `.env` file (already in `.gitignore`)
   - Rotate GitHub tokens periodically
   - Use minimal required scopes for tokens

4. **Custom Reports**
   - Use custom date ranges for specific sprints or milestones
   - Filter by organization for multi-org teams
   - Generate separate reports per repository if needed

## Future Enhancements

Potential improvements to consider:
- Export to CSV/JSON formats
- PR size/complexity metrics (lines changed, files modified)
- Review turnaround time analysis
- Team comparison charts
- Integration with JIRA/issue trackers
- HTML output with charts and graphs
- Scheduled automated report generation
- Slack/email notification integration
