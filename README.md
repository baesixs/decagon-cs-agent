# Bookly Care — agentic customer support POC

Interview-facing demo for [Decagon](https://decagon.ai): a small online bookstore support agent that is **conversational where we can** and **deterministic where it matters**.

Not an all-in-one agent product. Six tools. Application code owns return → refund and password-reset email.

## Principle

Do not make something an agent decision when normal software can handle it.

The model decides: *does this customer want a return?* / *do they want a reset email?*  
Bookly code decides: *validate, create the RMA, call payments* / *hit the identity mock without leaking whether the account exists.*

That is why returns are one tool (`createReturn`), not `createReturnCase` then `triggerRefundPayment`. Same for `requestPasswordReset` — not a chain of IdP calls.

## Architecture

```
user (text or voice)
  → LLM (intent + which tool)
      reads: findOrdersByEmail | getOrder | checkReturnEligibility | lookupPolicy
      writes: createReturn | requestPasswordReset
          createReturn → mock Returns → optional mock Payment
          requestPasswordReset → mock identity (no user enumeration)
  → customer-facing reply
  → Details panel (tools + nested HTTP)
```

- **Text:** OpenAI **Responses API** (`responses.create`), not Chat Completions. Custom function tools only. `previous_response_id` for multi-turn; `instructions` resent every call.
- **Voice:** OpenAI **Realtime** (WebRTC). Function calls POST to the same `/api/tools/execute`.
- **No** LangChain, Assistants hosted runner, or Responses built-in tools (`web_search`, MCP). Those would hide the loop.

## Tools

| Tool | Kind | Role |
| --- | --- | --- |
| `findOrdersByEmail` | read | List this email's orders |
| `getOrder` | read | Full line items for one order |
| `checkReturnEligibility` | read | Eligible or not + reason. No writes. |
| `lookupPolicy` | read | Canned shipping / returns / password_reset / general |
| `createReturn` | write | After customer confirms. Internally: Returns API, then Payment API if policy allows. |
| `requestPasswordReset` | write | After email is known. Mock identity API; does not reveal if the account exists. |

Happy path (return): `checkReturnEligibility` → eligible → **customer confirms** → `createReturn`.

Happy path (password): collect email → `requestPasswordReset`.

Identity for orders is **soft**: email must match the order. Password reset never confirms registration. This is not auth.

## Guardrails (fail closed)

`ORDER_NOT_FOUND`, `IDENTITY_MISMATCH`, `RETURN_WINDOW_EXPIRED`, `RETURN_NOT_ELIGIBLE`, `ITEM_NOT_ON_ORDER`, `ALREADY_RETURNED`.

`createReturn` re-runs eligibility. Confirmation is conversational; eligibility is code.

## Run locally

```bash
cp .env.example .env.local
# set OPENAI_API_KEY (Realtime-capable)

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo script

1. **Order status** — `ava@example.com` + `BK-1001` (delivered, two Le Guin titles).
2. **Eligible return** — check eligibility, confirm, watch the trace: `createReturn` → mock Returns → mock Payment.
3. **Expired window** — `BK-1002` (delivered May 2026).
4. **Wrong email** — `BK-1001` as `sam@example.com` → `IDENTITY_MISMATCH`.
5. **Unknown id** — `BK-9999`.
6. **Shipping** — `BK-1003` in transit.
7. **Password** — `requestPasswordReset` → mock identity API (generic “if an account exists” message). `lookupPolicy(password_reset)` for link lifetime.
8. **Voice** — Connect voice, same tools, same trace.

## Env

| Variable | Default |
| --- | --- |
| `OPENAI_API_KEY` | required |
| `OPENAI_TEXT_MODEL` | `gpt-4.1` |
| `OPENAI_REALTIME_MODEL` | `gpt-4o-realtime-preview` |
| `OPENAI_REALTIME_VOICE` | `alloy` |

Do not commit `.env.local`.

## Limitations (POC)

- In-memory store (resets on server restart).
- Soft email match, not login.
- Mock Returns, Payment, and identity HTTP APIs — not Stripe/OMS/Auth0.
- No cancel-order writes.
- Realtime needs mic permission and a key with Realtime access.

## Code map

| Path | What to read |
| --- | --- |
| [`src/lib/agent/orchestrator.ts`](src/lib/agent/orchestrator.ts) | Responses API loop |
| [`src/lib/agent/tools.ts`](src/lib/agent/tools.ts) | Tool catalog + `executeTool` |
| [`src/lib/guardrails/index.ts`](src/lib/guardrails/index.ts) | Fail-closed checks |
| [`src/lib/returns/createReturn.ts`](src/lib/returns/createReturn.ts) | App orchestration (RMA → refund) |
| [`src/app/api/tools/execute/route.ts`](src/app/api/tools/execute/route.ts) | Shared text + voice execute |
