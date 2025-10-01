# AWS Cost Explorer MCP Server - Development Guide

## Project Overview
This is a Model Context Protocol (MCP) server that provides AWS Cost Explorer API access to Claude Desktop.

## Security Scanning with Snyk

This project uses Snyk CLI (configured locally) for security scanning.

### Available Snyk Scans

- **Dependency scan**: `snyk test` - Check for vulnerabilities in npm packages
- **Monitor**: `snyk monitor` - Track vulnerabilities over time

### When Claude Runs Snyk Automatically

**Claude will proactively run `snyk test` when:**
1. **Adding or updating npm dependencies** - After `npm install` or package.json changes
2. **Before committing code to git** - When you ask to commit changes
3. **After significant code changes** - When modifying source files in src/
4. **When explicitly requested** - "Run Snyk scan" or "Check for vulnerabilities"

**Scan commands:**
```bash
snyk test                    # Scan dependencies
snyk monitor                 # Monitor for new vulnerabilities
```

**Note:** No git hooks required - Claude handles security scanning as part of the development workflow.

**Latest scan results:** ✅ No vulnerabilities found (168 dependencies tested)

### Security Best Practices

1. **Never commit secrets**: Ensure `.env` is gitignored
2. **Keep dependencies updated**: Regular npm audit and Snyk scans
3. **Review Snyk findings**: Address high/critical vulnerabilities first
4. **AWS credentials**: Use SSO when possible, never hardcode keys
5. **Least privilege**: Ensure IAM roles have minimal required permissions

## Development Workflow

1. Make code changes
2. Build: `npm run build`
3. **Run Snyk scan** to check for vulnerabilities
4. Test with MCP Inspector: `npx @modelcontextprotocol/inspector node build/index.js`
5. Test with Claude Desktop (restart after changes)
6. Commit if all checks pass

## Architecture Notes

- **Local MCP server**: Runs via stdio transport in Claude Desktop
- **AWS SDK**: Uses standard AWS credential chain (SSO, env vars, credentials file)
- **Security**: All credentials stay local, no remote data storage

## Key Files

- `src/index.ts`: MCP server entry point
- `src/cost-explorer.ts`: AWS Cost Explorer API wrapper
- `.env`: Local credentials (NEVER commit)
- `.env.example`: Template for credentials
- `README.md`: User documentation
