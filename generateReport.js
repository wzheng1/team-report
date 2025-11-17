#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');
const { program } = require('commander');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize GitHub API client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * Check GitHub API rate limit status
 */
async function checkRateLimit() {
  try {
    const { data } = await octokit.rateLimit.get();
    const { remaining, limit, reset } = data.rate;
    const resetDate = new Date(reset * 1000);

    return {
      remaining,
      limit,
      reset: resetDate,
      resetIn: Math.ceil((resetDate - new Date()) / 1000 / 60) // minutes
    };
  } catch (error) {
    console.warn('Could not check rate limit:', error.message);
    return null;
  }
}

/**
 * Log rate limit status
 */
async function logRateLimit(prefix = '') {
  const rateLimit = await checkRateLimit();
  if (rateLimit) {
    console.log(`${prefix}Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    if (rateLimit.remaining < 100) {
      console.warn(`⚠️  Warning: Low rate limit! Resets in ${rateLimit.resetIn} minutes`);
    }
  }
}

/**
 * Wait for rate limit to reset
 */
async function waitForRateLimit() {
  const rateLimit = await checkRateLimit();
  if (rateLimit && rateLimit.remaining === 0) {
    const waitMinutes = rateLimit.resetIn + 1; // Add 1 minute buffer
    console.log(`\n⏳ Rate limit exceeded. Waiting ${waitMinutes} minutes until reset...`);
    console.log(`   Reset time: ${rateLimit.reset.toLocaleString()}`);

    // Wait for rate limit to reset
    await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
    console.log('✓ Rate limit reset. Resuming...\n');
  }
}

/**
 * Execute a function with rate limit handling and retry logic
 */
async function withRateLimit(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check if we're close to rate limit
      const rateLimit = await checkRateLimit();
      if (rateLimit && rateLimit.remaining < 10) {
        console.log('⚠️  Approaching rate limit, waiting before next request...');
        await waitForRateLimit();
      }

      return await fn();
    } catch (error) {
      // Check if it's a rate limit error
      if (error.status === 403 && error.message.includes('rate limit')) {
        console.log(`\n⚠️  Rate limit error encountered (attempt ${attempt}/${retries})`);
        await waitForRateLimit();

        if (attempt === retries) {
          throw new Error('Rate limit exceeded and max retries reached');
        }
        continue;
      }

      // Check for other retryable errors (network issues, timeouts)
      if (error.status >= 500 || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
        console.log(`⚠️  Temporary error (${error.message}), retrying in 5 seconds... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        if (attempt === retries) {
          throw error;
        }
        continue;
      }

      // Non-retryable error, throw immediately
      throw error;
    }
  }
}

/**
 * Read users from github_users file
 */
function readUsersFromFile(filePath = './github_users') {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}

/**
 * Calculate date range based on period
 */
function calculateDateRange(period) {
  const endDate = new Date();
  const startDate = new Date();

  if (period.endsWith('d')) {
    // Days (e.g., "7d", "30d")
    const days = parseInt(period);
    startDate.setDate(endDate.getDate() - days);
  } else if (period.endsWith('w')) {
    // Weeks (e.g., "1w", "3w")
    const weeks = parseInt(period);
    startDate.setDate(endDate.getDate() - (weeks * 7));
  } else if (period.endsWith('m')) {
    // Months (e.g., "1m", "3m")
    const months = parseInt(period);
    startDate.setMonth(endDate.getMonth() - months);
  } else if (period.includes('..')) {
    // Custom range (e.g., "2025-01-01..2025-01-31")
    const [start, end] = period.split('..');
    return {
      startDate: new Date(start),
      endDate: new Date(end)
    };
  } else {
    console.error('Invalid period format. Use: 7d, 3w, 1m, or YYYY-MM-DD..YYYY-MM-DD');
    process.exit(1);
  }

  return { startDate, endDate };
}

/**
 * Fetch detailed PR statistics (additions, deletions, changed files)
 */
async function fetchPRStats(owner, repo, prNumber) {
  try {
    const { data } = await withRateLimit(async () => {
      return await octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
    });

    return {
      additions: data.additions || 0,
      deletions: data.deletions || 0,
      changedFiles: data.changed_files || 0,
      commits: data.commits || 0
    };
  } catch (error) {
    // If we can't fetch stats, return zeros instead of failing
    console.warn(`  Could not fetch stats for PR #${prNumber}: ${error.message}`);
    return {
      additions: 0,
      deletions: 0,
      changedFiles: 0,
      commits: 0
    };
  }
}

/**
 * Calculate PR complexity indicator
 */
function calculateComplexity(stats) {
  const totalChanges = stats.additions + stats.deletions;
  const files = stats.changedFiles;

  // Complexity scoring:
  // - Small: < 100 lines, < 5 files
  // - Medium: < 500 lines, < 15 files
  // - Large: < 1000 lines, < 30 files
  // - Very Large: >= 1000 lines or >= 30 files

  if (totalChanges < 100 && files < 5) {
    return { level: 'Small', emoji: '🟢', score: 1 };
  } else if (totalChanges < 500 && files < 15) {
    return { level: 'Medium', emoji: '🟡', score: 2 };
  } else if (totalChanges < 1000 && files < 30) {
    return { level: 'Large', emoji: '🟠', score: 3 };
  } else {
    return { level: 'Very Large', emoji: '🔴', score: 4 };
  }
}

/**
 * Fetch all PRs created by a user across all repos
 * Uses pagination to fetch all results (not limited to 100)
 * Includes rate limit handling and retry logic
 */
async function fetchCreatedPRs(username, startDate, endDate, org = null) {
  const query = org
    ? `author:${username} org:${org} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`
    : `author:${username} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;

  try {
    // Use withRateLimit wrapper for automatic rate limit handling
    const allPRs = await withRateLimit(async () => {
      return await octokit.paginate(
        octokit.search.issuesAndPullRequests,
        {
          q: query,
          per_page: 100,
          sort: 'created',
          order: 'desc'
        },
        (response) => response.data
      );
    });

    // Fetch detailed stats for each PR
    const prsWithStats = [];
    for (const pr of allPRs) {
      const repoPath = pr.repository_url.split('/').slice(-2);
      const [owner, repo] = repoPath;

      // Fetch PR stats
      const stats = await fetchPRStats(owner, repo, pr.number);
      const complexity = calculateComplexity(stats);

      prsWithStats.push({
        title: pr.title,
        number: pr.number,
        url: pr.html_url,
        repo: `${owner}/${repo}`,
        state: pr.state,
        createdAt: pr.created_at,
        closedAt: pr.closed_at,
        merged: pr.pull_request?.merged_at ? true : false,
        body: pr.body || '',
        stats: {
          additions: stats.additions,
          deletions: stats.deletions,
          changedFiles: stats.changedFiles,
          commits: stats.commits,
          totalChanges: stats.additions + stats.deletions
        },
        complexity
      });
    }

    return prsWithStats;
  } catch (error) {
    console.error(`Error fetching created PRs for ${username}:`, error.message);
    return [];
  }
}

/**
 * Fetch all PRs reviewed by a user
 * Uses pagination to fetch all results (not limited to 100)
 * Includes rate limit handling and retry logic
 */
async function fetchReviewedPRs(username, startDate, endDate, org = null) {
  const query = org
    ? `reviewed-by:${username} org:${org} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`
    : `reviewed-by:${username} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;

  try {
    // Use withRateLimit wrapper for automatic rate limit handling
    const allPRs = await withRateLimit(async () => {
      return await octokit.paginate(
        octokit.search.issuesAndPullRequests,
        {
          q: query,
          per_page: 100,
          sort: 'created',
          order: 'desc'
        },
        (response) => response.data
      );
    });

    return allPRs.map(pr => ({
      title: pr.title,
      number: pr.number,
      url: pr.html_url,
      repo: pr.repository_url.split('/').slice(-2).join('/'),
      state: pr.state,
      author: pr.user.login,
      createdAt: pr.created_at
    }));
  } catch (error) {
    console.error(`Error fetching reviewed PRs for ${username}:`, error.message);
    return [];
  }
}

/**
 * Extract benefits and key points from PR description
 */
function extractPRBenefits(pr) {
  const body = pr.body.toLowerCase();
  const benefits = [];

  // Common benefit keywords
  if (body.includes('fix') || body.includes('bug')) {
    benefits.push('Bug fix');
  }
  if (body.includes('performance') || body.includes('optimize')) {
    benefits.push('Performance improvement');
  }
  if (body.includes('security') || body.includes('vulnerability')) {
    benefits.push('Security enhancement');
  }
  if (body.includes('feature') || body.includes('add')) {
    benefits.push('New feature');
  }
  if (body.includes('refactor') || body.includes('clean')) {
    benefits.push('Code quality improvement');
  }
  if (body.includes('test') || body.includes('coverage')) {
    benefits.push('Test coverage');
  }
  if (body.includes('doc') || body.includes('readme')) {
    benefits.push('Documentation');
  }

  return benefits.length > 0 ? benefits : ['Code contribution'];
}

/**
 * Detect notable PRs for highlights section
 */
function detectNotablePRs(userData) {
  const allPRs = [];

  // Collect all PRs with user info
  userData.forEach(user => {
    user.created.forEach(pr => {
      allPRs.push({
        ...pr,
        username: user.username
      });
    });
  });

  const notable = {
    veryLarge: [],
    critical: [],
    security: [],
    features: []
  };

  allPRs.forEach(pr => {
    const title = pr.title.toLowerCase();
    const body = (pr.body || '').toLowerCase();

    // Very large PRs
    if (pr.complexity?.level === 'Very Large' && pr.merged) {
      notable.veryLarge.push(pr);
    }

    // Critical fixes
    if ((title.includes('critical') || title.includes('urgent') ||
         title.includes('hotfix') || body.includes('critical')) && pr.merged) {
      notable.critical.push(pr);
    }

    // Security fixes
    if ((title.includes('security') || title.includes('vulnerability') ||
         title.includes('cve') || body.includes('security')) && pr.merged) {
      notable.security.push(pr);
    }

    // New features
    if ((title.includes('feature') || title.includes('feat:') ||
         title.includes('add') || body.includes('new feature')) && pr.merged) {
      notable.features.push(pr);
    }
  });

  return notable;
}

/**
 * Rank contributors by different metrics
 */
function rankContributors(userData) {
  const rankings = {
    byPRs: [],
    byCodeImpact: [],
    byReviews: [],
    byMergeRate: []
  };

  userData.forEach(user => {
    const mergedCount = user.created.filter(pr => pr.merged).length;
    const codeImpact = user.created.reduce((sum, pr) =>
      sum + (pr.stats?.totalChanges || 0), 0);
    const mergeRate = user.created.length > 0
      ? (mergedCount / user.created.length) * 100
      : 0;

    rankings.byPRs.push({
      username: user.username,
      count: user.created.length,
      merged: mergedCount
    });

    rankings.byCodeImpact.push({
      username: user.username,
      impact: codeImpact,
      prs: user.created.length
    });

    rankings.byReviews.push({
      username: user.username,
      count: user.reviewed.length
    });

    rankings.byMergeRate.push({
      username: user.username,
      rate: mergeRate,
      total: user.created.length
    });
  });

  // Sort each ranking
  rankings.byPRs.sort((a, b) => b.count - a.count);
  rankings.byCodeImpact.sort((a, b) => b.impact - a.impact);
  rankings.byReviews.sort((a, b) => b.count - a.count);
  rankings.byMergeRate.sort((a, b) => b.rate - a.rate);

  return rankings;
}

/**
 * Generate markdown report
 */
function generateReport(userData, startDate, endDate) {
  const formattedStart = startDate.toISOString().split('T')[0];
  const formattedEnd = endDate.toISOString().split('T')[0];

  let report = `# GitHub Pull Request Activity Report\n\n`;
  report += `**Period:** ${formattedStart} to ${formattedEnd}\n\n`;
  report += `**Generated:** ${new Date().toISOString().split('T')[0]}\n\n`;
  report += `---\n\n`;

  // Executive Summary
  const totalCreated = userData.reduce((sum, user) => sum + user.created.length, 0);
  const totalReviewed = userData.reduce((sum, user) => sum + user.reviewed.length, 0);
  const totalMerged = userData.reduce((sum, user) => sum + user.created.filter(pr => pr.merged).length, 0);

  // Calculate code change stats
  const totalAdditions = userData.reduce((sum, user) =>
    sum + user.created.reduce((s, pr) => s + (pr.stats?.additions || 0), 0), 0);
  const totalDeletions = userData.reduce((sum, user) =>
    sum + user.created.reduce((s, pr) => s + (pr.stats?.deletions || 0), 0), 0);
  const totalFilesChanged = userData.reduce((sum, user) =>
    sum + user.created.reduce((s, pr) => s + (pr.stats?.changedFiles || 0), 0), 0);
  const avgPRSize = totalCreated > 0 ? Math.round((totalAdditions + totalDeletions) / totalCreated) : 0;

  report += `## Executive Summary\n\n`;
  report += `This report provides an overview of GitHub pull request activity for ${userData.length} contributor(s) during the specified period.\n\n`;
  report += `### Key Metrics\n\n`;
  report += `- **Total PRs Created:** ${totalCreated}\n`;
  report += `- **Total PRs Merged:** ${totalMerged}\n`;
  report += `- **Total PRs Reviewed:** ${totalReviewed}\n`;
  report += `- **Merge Rate:** ${totalCreated > 0 ? ((totalMerged / totalCreated) * 100).toFixed(1) : 0}%\n\n`;

  report += `### Code Changes\n\n`;
  report += `- **Total Lines Added:** ${totalAdditions.toLocaleString()}\n`;
  report += `- **Total Lines Deleted:** ${totalDeletions.toLocaleString()}\n`;
  report += `- **Total Files Changed:** ${totalFilesChanged.toLocaleString()}\n`;
  report += `- **Average PR Size:** ${avgPRSize.toLocaleString()} lines changed\n\n`;

  report += `---\n\n`;

  // Highlights Section
  if (totalCreated > 0) {
    const notable = detectNotablePRs(userData);
    const rankings = rankContributors(userData);

    report += `## 🏆 Highlights\n\n`;

    // Notable PRs
    let hasNotable = false;

    if (notable.critical.length > 0) {
      hasNotable = true;
      report += `### 🚨 Critical Fixes\n\n`;
      notable.critical.slice(0, 3).forEach(pr => {
        report += `- **${pr.title}** by @${pr.username}\n`;
        report += `  - [#${pr.number}](${pr.url}) in ${pr.repo}\n`;
        report += `  - ${pr.complexity?.emoji || ''} ${pr.stats?.totalChanges.toLocaleString() || 0} lines changed\n\n`;
      });
    }

    if (notable.security.length > 0) {
      hasNotable = true;
      report += `### 🔒 Security Enhancements\n\n`;
      notable.security.slice(0, 3).forEach(pr => {
        report += `- **${pr.title}** by @${pr.username}\n`;
        report += `  - [#${pr.number}](${pr.url}) in ${pr.repo}\n`;
        report += `  - ${pr.complexity?.emoji || ''} ${pr.stats?.totalChanges.toLocaleString() || 0} lines changed\n\n`;
      });
    }

    if (notable.features.length > 0) {
      hasNotable = true;
      report += `### ✨ New Features\n\n`;
      notable.features.slice(0, 3).forEach(pr => {
        report += `- **${pr.title}** by @${pr.username}\n`;
        report += `  - [#${pr.number}](${pr.url}) in ${pr.repo}\n`;
        report += `  - ${pr.complexity?.emoji || ''} ${pr.stats?.totalChanges.toLocaleString() || 0} lines changed\n\n`;
      });
    }

    if (notable.veryLarge.length > 0) {
      hasNotable = true;
      report += `### 🔴 Major Changes (Very Large PRs)\n\n`;
      notable.veryLarge.slice(0, 3).forEach(pr => {
        report += `- **${pr.title}** by @${pr.username}\n`;
        report += `  - [#${pr.number}](${pr.url}) in ${pr.repo}\n`;
        report += `  - 🔴 Very Large: ${pr.stats?.totalChanges.toLocaleString() || 0} lines changed across ${pr.stats?.changedFiles || 0} files\n\n`;
      });
    }

    // Top Contributors
    report += `### 🌟 Top Contributors\n\n`;

    // Most Productive (by PRs)
    if (rankings.byPRs.length > 0 && rankings.byPRs[0].count > 0) {
      const top = rankings.byPRs[0];
      report += `- **Most Active:** @${top.username} (${top.count} PR${top.count > 1 ? 's' : ''} created, ${top.merged} merged)\n`;
    }

    // Biggest Code Impact
    if (rankings.byCodeImpact.length > 0 && rankings.byCodeImpact[0].impact > 0) {
      const top = rankings.byCodeImpact[0];
      report += `- **Largest Impact:** @${top.username} (${top.impact.toLocaleString()} lines changed across ${top.prs} PR${top.prs > 1 ? 's' : ''})\n`;
    }

    // Top Reviewer
    if (rankings.byReviews.length > 0 && rankings.byReviews[0].count > 0) {
      const top = rankings.byReviews[0];
      report += `- **Top Reviewer:** @${top.username} (${top.count} review${top.count > 1 ? 's' : ''})\n`;
    }

    // Best Merge Rate (only if they have at least 2 PRs)
    const qualifiedMergers = rankings.byMergeRate.filter(r => r.total >= 2);
    if (qualifiedMergers.length > 0 && qualifiedMergers[0].rate === 100) {
      const top = qualifiedMergers[0];
      report += `- **Perfect Merge Rate:** @${top.username} (${top.total}/${top.total} PRs merged)\n`;
    }

    report += `\n---\n\n`;
  }

  // Individual User Reports
  userData.forEach(user => {
    report += `## ${user.username}\n\n`;

    // User Summary
    const mergedCount = user.created.filter(pr => pr.merged).length;
    const openCount = user.created.filter(pr => pr.state === 'open').length;

    // Calculate user's code stats
    const userAdditions = user.created.reduce((s, pr) => s + (pr.stats?.additions || 0), 0);
    const userDeletions = user.created.reduce((s, pr) => s + (pr.stats?.deletions || 0), 0);
    const userFilesChanged = user.created.reduce((s, pr) => s + (pr.stats?.changedFiles || 0), 0);
    const userAvgPRSize = user.created.length > 0 ? Math.round((userAdditions + userDeletions) / user.created.length) : 0;

    // Calculate complexity distribution
    const complexityDist = {
      small: user.created.filter(pr => pr.complexity?.level === 'Small').length,
      medium: user.created.filter(pr => pr.complexity?.level === 'Medium').length,
      large: user.created.filter(pr => pr.complexity?.level === 'Large').length,
      veryLarge: user.created.filter(pr => pr.complexity?.level === 'Very Large').length
    };

    report += `### Summary\n\n`;
    report += `- **PRs Created:** ${user.created.length}\n`;
    report += `  - Merged: ${mergedCount}\n`;
    report += `  - Open: ${openCount}\n`;
    report += `  - Closed: ${user.created.length - mergedCount - openCount}\n`;
    report += `- **PRs Reviewed:** ${user.reviewed.length}\n`;

    if (user.created.length > 0) {
      report += `\n**Code Statistics:**\n`;
      report += `- **Lines Added:** ${userAdditions.toLocaleString()}\n`;
      report += `- **Lines Deleted:** ${userDeletions.toLocaleString()}\n`;
      report += `- **Files Changed:** ${userFilesChanged.toLocaleString()}\n`;
      report += `- **Average PR Size:** ${userAvgPRSize.toLocaleString()} lines\n`;
      report += `\n**PR Complexity Distribution:**\n`;
      report += `- 🟢 Small: ${complexityDist.small} | 🟡 Medium: ${complexityDist.medium} | 🟠 Large: ${complexityDist.large} | 🔴 Very Large: ${complexityDist.veryLarge}\n`;
    }

    report += `\n`;

    // Created PRs
    if (user.created.length > 0) {
      report += `### Pull Requests Created\n\n`;

      user.created.forEach((pr, index) => {
        const benefits = extractPRBenefits(pr);
        const statusIcon = pr.merged ? '✅' : pr.state === 'open' ? '🔄' : '❌';

        report += `#### ${index + 1}. ${statusIcon} ${pr.title}\n\n`;
        report += `- **Repository:** ${pr.repo}\n`;
        report += `- **PR Number:** [#${pr.number}](${pr.url})\n`;
        report += `- **Status:** ${pr.merged ? 'Merged' : pr.state}\n`;
        report += `- **Created:** ${new Date(pr.createdAt).toISOString().split('T')[0]}\n`;
        if (pr.closedAt) {
          report += `- **Closed:** ${new Date(pr.closedAt).toISOString().split('T')[0]}\n`;
        }

        // Add PR stats if available
        if (pr.stats) {
          report += `- **Complexity:** ${pr.complexity?.emoji || ''} ${pr.complexity?.level || 'Unknown'}\n`;
          report += `- **Changes:** +${pr.stats.additions.toLocaleString()} / -${pr.stats.deletions.toLocaleString()} lines\n`;
          report += `- **Files Changed:** ${pr.stats.changedFiles}\n`;
          if (pr.stats.commits) {
            report += `- **Commits:** ${pr.stats.commits}\n`;
          }
        }

        report += `\n**Introduction:**\n`;
        const intro = pr.body.split('\n').slice(0, 3).join(' ').substring(0, 200);
        report += `${intro || 'No description provided'}${intro.length >= 200 ? '...' : ''}\n\n`;

        report += `**Benefits:**\n`;
        benefits.forEach(benefit => {
          report += `- ${benefit}\n`;
        });
        report += `\n`;
      });
    }

    // Reviewed PRs
    if (user.reviewed.length > 0) {
      report += `### Pull Requests Reviewed\n\n`;
      report += `${user.username} provided reviews for ${user.reviewed.length} pull request(s):\n\n`;

      // Group by repository
      const reviewsByRepo = user.reviewed.reduce((acc, pr) => {
        if (!acc[pr.repo]) acc[pr.repo] = [];
        acc[pr.repo].push(pr);
        return acc;
      }, {});

      Object.entries(reviewsByRepo).forEach(([repo, prs]) => {
        report += `**${repo}** (${prs.length} review${prs.length > 1 ? 's' : ''}):\n`;
        prs.forEach(pr => {
          report += `- [#${pr.number}](${pr.url}) - ${pr.title} (by @${pr.author})\n`;
        });
        report += `\n`;
      });
    }

    report += `---\n\n`;
  });

  // Overall Benefits
  report += `## Overall Impact & Benefits\n\n`;
  report += `The contributions during this period demonstrate:\n\n`;
  report += `1. **Active Development:** ${totalCreated} pull requests created, showing ongoing feature development and improvements\n`;
  report += `2. **Code Quality:** ${totalReviewed} pull requests reviewed, ensuring code quality through peer review\n`;
  report += `3. **Delivery Rate:** ${((totalMerged / totalCreated) * 100).toFixed(1)}% of created PRs were successfully merged\n`;
  report += `4. **Collaboration:** Team members actively reviewing each other's code promotes knowledge sharing and quality\n\n`;

  return report;
}

/**
 * Main function
 */
async function main() {
  program
    .name('generateReport')
    .description('Generate GitHub PR activity report for users')
    .option('-u, --users <users>', 'Comma-separated list of GitHub usernames')
    .option('-f, --file <path>', 'Path to file containing GitHub usernames (default: ./github_users)', './github_users')
    .option('-p, --period <period>', 'Time period (e.g., 7d, 3w, 1m, or YYYY-MM-DD..YYYY-MM-DD)', '7d')
    .option('-o, --org <org>', 'Filter by GitHub organization')
    .option('--output <path>', 'Output file path (default: report.md)', 'report.md')
    .parse(process.argv);

  const options = program.opts();

  // Check for GitHub token
  if (!process.env.GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is not set.');
    console.error('Please create a .env file with your GitHub personal access token:');
    console.error('GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }

  // Get users
  let users = [];
  if (options.users) {
    users = options.users.split(',').map(u => u.trim());
  } else {
    users = readUsersFromFile(options.file);
  }

  console.log(`Generating report for ${users.length} user(s)...`);

  // Get date range
  const { startDate, endDate } = calculateDateRange(options.period);
  console.log(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

  // Check initial rate limit status
  console.log('');
  await logRateLimit('Initial ');

  // Fetch data for each user
  const userData = [];
  for (const username of users) {
    console.log(`\nFetching data for ${username}...`);

    const created = await fetchCreatedPRs(username, startDate, endDate, options.org);
    console.log(`  - Created PRs: ${created.length}`);

    const reviewed = await fetchReviewedPRs(username, startDate, endDate, options.org);
    console.log(`  - Reviewed PRs: ${reviewed.length}`);

    userData.push({
      username,
      created,
      reviewed
    });
  }

  // Check final rate limit status
  console.log('');
  await logRateLimit('Final ');

  // Generate report
  const report = generateReport(userData, startDate, endDate);

  // Save report
  fs.writeFileSync(options.output, report);
  console.log(`\nReport generated successfully: ${options.output}`);
}

// Run the script
main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
