# Bitget MCP Integration

This repo is wired up with [Bitget's official MCP server](https://www.npmjs.com/package/@bitget-ai/bitget-agent-mcp)
(`@bitget-ai/bitget-agent-mcp`, part of the Bitget Agent Hub). It lets MCP-compatible
AI hosts — Claude Code, Claude Desktop, Cursor, Windsurf, etc. — query Bitget market
data and (with API keys) operate a Bitget account through natural language.

The server config lives in [`.mcp.json`](../.mcp.json) at the repo root. Claude Code
picks it up automatically when you open this project; approve the `bitget` server when
prompted.

## What you get

The default profile loads 14 tools (12 intent verbs + `discover` + `raw`) covering
market data, spot/futures orders, positions, balances, transfers, deposits,
withdrawals and sub-accounts — backed by 109 operations of the Bitget UTA v3 API.

- **No credentials needed** for public market data: prices, candles, order books,
  funding rates. Try: *"What's the current BTC price on Bitget?"*
- **Credentials required** for anything touching an account: balances, orders,
  transfers.

## Adding API keys (optional)

1. Create a key at [Bitget API Management](https://www.bitget.com/en/api-management)
   with **Read** (and **Trade** if you want order placement). Do **not** enable
   withdrawal permissions unless you truly need them.
2. Copy `.env.example` to `.env` (gitignored) or export the variables in your shell:

   ```bash
   export BITGET_API_KEY=...
   export BITGET_SECRET_KEY=...
   export BITGET_PASSPHRASE=...
   ```

   `.mcp.json` expands these at launch — real keys are never committed.

## Safety modes

Edit the `args` in `.mcp.json`:

- `"--read-only"` — blocks every write (orders, transfers, withdrawals). Recommended
  while exploring with real keys.
- `"--paper-trading"` — routes to Bitget's Demo Trading environment (needs a separate
  Demo API key). Mutually exclusive with `--read-only`.
- `"--modules", "account,trade,market,cryptoloans,tax"` — load extra modules
  (default: `account,trade,market`).

High-risk operations (cancel-all, withdraw) always require an explicit confirmation,
and any write supports `dryRun: true`.

## Verify it works

Ask your AI host: *"What Bitget tools are available?"* — you should see `market`,
`order`, `position`, `account_overview`, `discover`, `raw`, and friends.
