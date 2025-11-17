# GitHub PR Activity Report Generator

A Node.js tool to generate comprehensive reports of GitHub pull request activity for users, including PRs created and reviewed during a specified time period.

## Features

### Core Capabilities
- 📊 Generate reports for multiple users or a single user
- 📅 Customizable time periods (days, weeks, months, or custom date ranges)
- 🔍 Track PRs created and reviewed with full pagination (no limits)
- 📈 Comprehensive code metrics (lines changed, files modified, complexity)
- 🏆 Automatic highlights detection (critical fixes, features, top contributors)
- 🎯 Two report formats: detailed (engineers) or condensed (managers)
- 🔄 Automatic rate limit handling with smart retry
- 🏢 Filter by GitHub organization
- 📝 Export to formatted Markdown reports

### Advanced Features
- **PR Metrics**: Lines added/deleted, files changed, commit counts
- **Complexity Indicators**: 🟢 Small | 🟡 Medium | 🟠 Large | 🔴 Very Large
- **Highlights Section**: Auto-detects notable PRs and ranks top contributors
- **Team Summary Table**: At-a-glance comparison of all team members
- **Condensed Mode**: Manager-friendly reports (50% shorter)
- **Rate Limit Protection**: Automatic detection, waiting, and retry

## Prerequisites

- Node.js (v14 or higher)
- GitHub Personal Access Token

## Setup

1. **Clone or navigate to the project directory**

```bash
cd team-report
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
- `--condensed` - Generate condensed report (manager-friendly, 50% shorter)

### Examples

**1. Report for users in github_users file (last 7 days)**
```bash
node generateReport.js
```

**2. Report for specific users (last 3 weeks)**
```bash
node generateReport.js -u "user1,user2" -p 3w
```

**3. Report for a single user (last month)**
```bash
node generateReport.js -u "user1" -p 1m
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

**9. Condensed weekly report (manager-friendly)**
```bash
node generateReport.js -p 7d --condensed
```

**10. Condensed monthly report for stakeholders**
```bash
node generateReport.js -p 1m --condensed --output monthly-summary.md
```

## GitHub Users File Format

Create a `github_users` file with one GitHub username per line:

```bash
# Copy the example file
cp github_users.example github_users
```

Then edit `github_users` and add your team members:

```
user1
user2
user3
```

Lines that are empty or contain only whitespace will be ignored.

## Report Contents

### Two Report Formats

#### **Full Report** (Default - for Engineers)
Comprehensive details perfect for technical reviews and deep dives.

#### **Condensed Report** (`--condensed` - for Managers)
Executive summary focused on key metrics and highlights (50% shorter).

---

### 📊 Executive Summary
Both formats include:
- **Key Metrics**: Total PRs created, merged, reviewed, merge rate
- **Code Changes**: Total lines added/deleted, files changed, average PR size
- Team velocity and performance overview

### 🏆 Highlights Section (NEW!)
Auto-generated highlights featuring:

**Notable PRs:**
- 🚨 **Critical Fixes** - Urgent/hotfix PRs
- 🔒 **Security Enhancements** - Security and vulnerability fixes
- ✨ **New Features** - Feature additions and enhancements
- 🔴 **Major Changes** - Very Large PRs (massive code changes)

**Top Contributors:**
- 🥇 Most Active (by PR count)
- 💪 Largest Impact (by lines changed)
- ⭐ Top Reviewer (by reviews performed)
- 🎯 Perfect Merge Rate (100% merged, min 2 PRs)

### 📋 Team Summary Table (Condensed Mode Only)
Quick comparison of all team members:

| Contributor | PRs | Merged | Open | Reviews | Lines Changed | Avg Size | Top Complexity |
|-------------|-----|--------|------|---------|---------------|----------|----------------|

### 👥 Per-User Sections

#### In Full Report:
1. **Summary Statistics**
   - Number of PRs created (merged, open, closed)
   - Number of PRs reviewed
   - Code statistics (lines added/deleted, files changed, average PR size)
   - PR complexity distribution (🟢🟡🟠🔴)

2. **Pull Requests Created** (detailed)
   - Title and status (✅ merged, 🔄 open, ❌ closed)
   - Repository name
   - PR number with clickable link
   - Creation and closure dates
   - **Complexity**: 🟢 Small | 🟡 Medium | 🟠 Large | 🔴 Very Large
   - **Changes**: +additions / -deletions (formatted)
   - **Files Changed**: Number of files modified
   - **Commits**: Number of commits
   - Brief introduction (from PR description)
   - Automatically detected benefits:
     - Bug fix, Performance improvement, Security enhancement
     - New feature, Code quality improvement
     - Test coverage, Documentation

3. **Pull Requests Reviewed** (detailed)
   - Grouped by repository
   - PR titles with links
   - Original authors

#### In Condensed Report:
1. **Summary Statistics** (same as full)
2. **Key Work** (highlights only)
   - Major changes and features surfaced
   - No detailed PR listings
3. **Reviews** (count only, no details)

### 📈 Overall Impact & Benefits
- Summary of team activity and collaboration metrics
- Code quality and delivery indicators

## Sample Output

### Full Report
```markdown
# GitHub Pull Request Activity Report

**Period:** 2025-01-01 to 2025-01-07
**Generated:** 2025-01-14

---

## Executive Summary

### Key Metrics
- **Total PRs Created:** 49
- **Total PRs Merged:** 33
- **Total PRs Reviewed:** 21
- **Merge Rate:** 67.3%

### Code Changes
- **Total Lines Added:** 83,586
- **Total Lines Deleted:** 11,957
- **Total Files Changed:** 829
- **Average PR Size:** 1,950 lines changed

---

## 🏆 Highlights

### 🔒 Security Enhancements
- **Fix critical vulnerability** by @user1
  - [#123](https://github.com/org/repo/pull/123)
  - 🟢 45 lines changed

### 🔴 Major Changes (Very Large PRs)
- **Upgrade to v2.0** by @user2
  - [#456](https://github.com/org/repo/pull/456)
  - 🔴 Very Large: 80,219 lines changed across 495 files

### 🌟 Top Contributors
- **Most Active:** @user1 (19 PRs created, 17 merged)
- **Largest Impact:** @user2 (81,250 lines changed)
- **Top Reviewer:** @user1 (13 reviews)

---

## user1

### Summary
- **PRs Created:** 5 (4 merged, 1 open, 0 closed)
- **PRs Reviewed:** 8

**Code Statistics:**
- **Lines Added:** 2,345
- **Lines Deleted:** 1,234
- **Files Changed:** 67
- **Average PR Size:** 716 lines

**PR Complexity Distribution:**
- 🟢 Small: 2 | 🟡 Medium: 2 | 🟠 Large: 1 | 🔴 Very Large: 0

### Pull Requests Created
#### 1. ✅ Fix memory leak in worker pool
- **Repository:** kubernetes/kubernetes
- **PR Number:** [#12345](https://github.com/...)
- **Status:** Merged
- **Complexity:** 🟡 Medium
- **Changes:** +234 / -89 lines
- **Files Changed:** 8
...
```

### Condensed Report
```markdown
# GitHub Pull Request Activity Report

**Period:** 2025-01-01 to 2025-01-07
**Generated:** 2025-01-14
**Format:** Condensed (Manager Summary)

> 📌 This is a condensed report focusing on key metrics and highlights.
> For detailed PR listings, run without the --condensed flag.

---

[Executive Summary - same as above]

[Highlights - same as above]

---

## 📋 Team Summary

| Contributor | PRs | Merged | Open | Reviews | Lines Changed | Avg Size | Top Complexity |
|-------------|-----|--------|------|---------|---------------|----------|----------------|
| user1       | 19  | 17     | 1    | 13      | 9,314         | 490      | 🟢 S (9)       |
| user2       | 7   | 5      | 0    | 1       | 81,250        | 11,607   | 🔴 VL (1)      |

---

## 👥 Individual Summaries

## user1
[Summary statistics - same as full]

**Key Work:**
- Major change: Upgrade to v2.0 (80,219 lines)
- Feature: New dashboard UI
- Fix: Critical security patch
```

## Troubleshooting

### Rate Limiting

GitHub API has rate limits (5,000 requests/hour for authenticated requests).

**Automatic Handling:**
- ✅ The tool automatically detects rate limits
- ✅ Shows current limit status at start and end
- ✅ Automatically waits when approaching limits (<10 remaining)
- ✅ Smart retry on rate limit errors (up to 3 attempts)
- ✅ Displays countdown and reset time when waiting

**What you'll see:**
```
Initial Rate limit: 4,987/5,000 remaining
⚠️  Approaching rate limit, waiting before next request...
⏳ Rate limit exceeded. Waiting 15 minutes until reset...
   Reset time: 2025-01-14 14:30:00
✓ Rate limit reset. Resuming...
Final Rate limit: 4,823/5,000 remaining
```

**Tips:**
- The tool uses ~1-2 requests per PR fetched
- For large teams (>20 users) or long periods (>1 month), expect longer execution times
- Rate limits reset every hour

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

## Use Cases & Best Practices

### When to Use Full Reports
- ✅ Detailed technical reviews
- ✅ Sprint retrospectives requiring PR-level analysis
- ✅ Performance reviews with specific PR examples
- ✅ Debugging team workflow issues
- ✅ Historical documentation

### When to Use Condensed Reports
- ✅ Weekly stand-up meetings
- ✅ Manager status updates
- ✅ Executive summaries
- ✅ Monthly stakeholder reports
- ✅ Quick team velocity checks

### Recommended Workflows

**Weekly Team Meeting:**
```bash
# Generate condensed report every Monday
node generateReport.js -p 7d --condensed
```

**Sprint Review:**
```bash
# 2-week sprint, full details
node generateReport.js -p 2w
```

**Monthly Manager Report:**
```bash
# Condensed monthly summary
node generateReport.js -p 1m --condensed --output monthly-report.md
```

**Quarterly Review:**
```bash
# Full quarterly report for performance reviews
node generateReport.js -p 3m --output Q1-2025.md
```

### Tips for Better Reports

1. **Keep `github_users` updated** - Add/remove team members as they join/leave
2. **Use consistent time periods** - Weekly reports on same day help track trends
3. **Save historical reports** - Track team growth over time
4. **Share condensed reports** - Easier for non-technical stakeholders
5. **Use org filter** - Focus on specific projects: `--org "yourorg"`

## Performance

- **Execution Time**: ~5-10 seconds per user (depends on PR count)
- **API Calls**: ~2 requests per PR (search + details)
- **Memory Usage**: <100MB for typical reports
- **Pagination**: Automatically fetches all PRs (no 100 PR limit)

## License

ISC

## Contributing

Feel free to submit issues or pull requests to improve this tool.

## Changelog

### Latest Features (2025-01)
- ✨ Added `--condensed` flag for manager-friendly reports
- 🏆 Auto-generated highlights section with notable PRs
- 📊 Team summary table for quick comparisons
- 📈 Comprehensive PR metrics (lines changed, complexity)
- 🔄 Automatic pagination (no PR limits)
- ⚡ Smart rate limit handling with auto-retry
- 🎯 PR complexity indicators (Small/Medium/Large/Very Large)
