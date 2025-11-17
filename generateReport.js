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
 * Fetch all PRs created by a user across all repos
 */
async function fetchCreatedPRs(username, startDate, endDate, org = null) {
  const query = org
    ? `author:${username} org:${org} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`
    : `author:${username} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;

  try {
    const result = await octokit.search.issuesAndPullRequests({
      q: query,
      per_page: 100,
      sort: 'created',
      order: 'desc'
    });

    return result.data.items.map(pr => ({
      title: pr.title,
      number: pr.number,
      url: pr.html_url,
      repo: pr.repository_url.split('/').slice(-2).join('/'),
      state: pr.state,
      createdAt: pr.created_at,
      closedAt: pr.closed_at,
      merged: pr.pull_request?.merged_at ? true : false,
      body: pr.body || ''
    }));
  } catch (error) {
    console.error(`Error fetching created PRs for ${username}:`, error.message);
    return [];
  }
}

/**
 * Fetch all PRs reviewed by a user
 */
async function fetchReviewedPRs(username, startDate, endDate, org = null) {
  const query = org
    ? `reviewed-by:${username} org:${org} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`
    : `reviewed-by:${username} is:pr created:${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`;

  try {
    const result = await octokit.search.issuesAndPullRequests({
      q: query,
      per_page: 100,
      sort: 'created',
      order: 'desc'
    });

    return result.data.items.map(pr => ({
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

  report += `## Executive Summary\n\n`;
  report += `This report provides an overview of GitHub pull request activity for ${userData.length} contributor(s) during the specified period.\n\n`;
  report += `### Key Metrics\n\n`;
  report += `- **Total PRs Created:** ${totalCreated}\n`;
  report += `- **Total PRs Merged:** ${totalMerged}\n`;
  report += `- **Total PRs Reviewed:** ${totalReviewed}\n`;
  report += `- **Merge Rate:** ${totalCreated > 0 ? ((totalMerged / totalCreated) * 100).toFixed(1) : 0}%\n\n`;

  report += `---\n\n`;

  // Individual User Reports
  userData.forEach(user => {
    report += `## ${user.username}\n\n`;

    // User Summary
    const mergedCount = user.created.filter(pr => pr.merged).length;
    const openCount = user.created.filter(pr => pr.state === 'open').length;

    report += `### Summary\n\n`;
    report += `- **PRs Created:** ${user.created.length}\n`;
    report += `  - Merged: ${mergedCount}\n`;
    report += `  - Open: ${openCount}\n`;
    report += `  - Closed: ${user.created.length - mergedCount - openCount}\n`;
    report += `- **PRs Reviewed:** ${user.reviewed.length}\n\n`;

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
