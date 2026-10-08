# 3. Testing Approach

The core of the tool is the LLM's judgement: does this diff satisfy this story? So testing centres on **controlled scenarios with a known answer**. For each one we write a story and a diff where we already know the right verdict, run the wizard end to end, and compare.

The three scenarios cover the three verdicts (PASS, PARTIAL, FAIL) and the multi-story case.

---

## Sample 1 — Clean PASS (single story)

**Purpose:** The model recognises a complete implementation and cites real evidence.

**Work item**
```
[ID:101] User Story: Add health-check endpoint
Description: Ops needs an endpoint to check the service is alive.
Acceptance Criteria:
- GET /health returns HTTP 200
- Response body is JSON {"status": "ok"}
- Endpoint requires no authentication
```

**Diff**
```diff
--- a/app/main.py
+++ b/app/main.py
@@ -10,6 +10,11 @@ app = FastAPI()
 app.include_router(users.router, prefix="/users", dependencies=[Depends(auth)])
+
+
+@app.get("/health")
+def health():
+    return {"status": "ok"}
```

**Good output looks like**
```json
[
  {
    "storyId": 101,
    "status": "PASS",
    "evidence": "@app.get(\"/health\") def health(): return {\"status\": \"ok\"} — registered directly on app without the auth dependency",
    "gaps": ""
  }
]
```

| Check | Expected |
|---|---|
| `status` | `PASS` |
| `evidence` | Quotes or names the `/health` route and the `{"status": "ok"}` body |
| `gaps` | Empty string |
| Notices the auth criterion | Says the route is not behind the `auth` dependency, or at least does not flag it as missing |
| PR title (Step 8) | Short and specific, e.g. "Add unauthenticated /health endpoint returning status ok" |

---

## Sample 2 — PARTIAL (criteria only partly met)

**Purpose:** The model finds the *specific* missing criterion rather than marking the story PASS because most of it is done.

**Work item**
```
[ID:202] User Story: Password reset via email
Description: Users who forget their password can reset it by email.
Acceptance Criteria:
- POST /auth/reset-request accepts an email and sends a reset link
- Reset token expires after 30 minutes
- Max 3 reset requests per email per hour (rate limit)
- POST /auth/reset-confirm sets the new password when given a valid token
```

**Diff (summary of a realistic change)**
```diff
+++ b/auth/routes.py
+@router.post("/reset-request")
+def reset_request(body: ResetRequest):
+    token = create_token(body.email, expires_minutes=30)
+    send_email(body.email, f"{BASE_URL}/reset?token={token}")
+    return {"sent": True}
+
+@router.post("/reset-confirm")
+def reset_confirm(body: ResetConfirm):
+    email = verify_token(body.token)
+    set_password(email, body.new_password)
+    return {"ok": True}
```
(No rate-limiting code anywhere in the diff.)

**Good output looks like**
```json
[
  {
    "storyId": 202,
    "status": "PARTIAL",
    "evidence": "reset_request creates a token with expires_minutes=30 and calls send_email; reset_confirm verifies the token and calls set_password",
    "gaps": "No rate limiting on /auth/reset-request — the 'max 3 requests per email per hour' criterion is not implemented"
  }
]
```

| Check | Expected |
|---|---|
| `status` | `PARTIAL`, **not** PASS |
| `gaps` | Names the rate-limit criterion specifically |
| `evidence` | Mentions `expires_minutes=30` and both endpoints |
| PR description | Has a "Known gaps" (or similar) section that mentions rate limiting |
| Reviewer comment | Points out the missing rate limit as a risk (abuse / email flooding) |

---

## Sample 3 — Multi-story: one PASS, one FAIL

**Purpose:** The model judges each story separately and does not let a good implementation of one story hide an unrelated story that was not done. It also checks that `storyId` matches correctly.

**Work items**
```
[ID:301] Bug: Cart page crashes when cart is empty
Acceptance Criteria:
- Empty cart shows "Your cart is empty" instead of throwing

[ID:302] User Story: Show cart item count in header
Acceptance Criteria:
- Header shows a badge with the number of items in the cart
- Badge updates when items are added or removed
```

**Diff**
```diff
+++ b/src/pages/Cart.tsx
-  const total = cart.items.reduce((s, i) => s + i.price, 0);
-  return <CartTable items={cart.items} total={total} />;
+  if (!cart.items?.length) {
+    return <p className="empty">Your cart is empty</p>;
+  }
+  const total = cart.items.reduce((s, i) => s + i.price, 0);
+  return <CartTable items={cart.items} total={total} />;
```
(No changes to the header component.)

**Good output looks like**
```json
[
  {
    "storyId": 301,
    "status": "PASS",
    "evidence": "Cart.tsx adds `if (!cart.items?.length) return <p>Your cart is empty</p>` before the reduce",
    "gaps": ""
  },
  {
    "storyId": 302,
    "status": "FAIL",
    "evidence": "No changes to any header component in the diff",
    "gaps": "Cart count badge in header is not implemented; no add/remove update logic"
  }
]
```

| Check | Expected |
|---|---|
| Array length | 2, one per selected work item |
| `storyId` values | 301 and 302, matching the selection so the UI shows the right titles |
| 301 | `PASS` with evidence from `Cart.tsx` |
| 302 | `FAIL`, not PARTIAL, because nothing related changed |
| UI | Step 7 shows one green and one red card; the button reads **"Raise PR anyway →"** |
| PR description | Lists both items, marks #302 as not addressed |

---

## 4. Manual verification procedure

For each sample:

1. **Set up the data.** In a scratch ADO project or sprint, create the work item(s) with the exact acceptance criteria above. In a scratch git repo with an ADO remote, create a feature branch with a commit matching the diff.
2. **Run the wizard** (F5 → `PR Helper: Open`): select the repo, the branches, all commits, the provider, ADO credentials, the sprint, and the work item(s).
3. **Step 7:** compare each card against the "Check / Expected" table.
4. **Step 8:** read the generated title, description and comment against the table. Create the PR as a **draft** and confirm in ADO that:
   - the work items are linked,
   - the reviewer comment appears as the first thread,
   - labels and reviewers were applied.
5. **Repeat on the other provider** (Copilot ↔ OpenAI). The verdicts should match. Evidence wording may differ.
6. **Re-run check:** click **Re-analyze** in Step 7. On the OpenAI path (`temperature=0`) the verdict should not change.

### Pass criteria for the tool

| Criterion | Threshold |
|---|---|
| Verdict matches expected | 3/3 samples, on both providers |
| Gap names the right criterion (Samples 2 and 3) | Yes |
| Evidence refers to real code in the diff (no invented file names) | Yes |
| Output parses as JSON (no error card) | Yes |
| PR created in ADO with links | Yes |

### Results log

> **Note to author:** record your actual runs here.

| Sample | Provider | Verdict(s) | Matches expected? | Notes |
|---|---|---|---|---|
| 1 | Copilot | | | |
| 1 | OpenAI | | | |
| 2 | Copilot | | | |
| 2 | OpenAI | | | |
| 3 | Copilot | | | |
| 3 | OpenAI | | | |

## 5. Non-AI paths also checked

| Area | How |
|---|---|
| Invalid repo path | Step 1 shows a validation error |
| Same FROM/TO branch / no commits | Step 3 shows an empty list |
| Bad ADO PAT | Step 5 validation fails with an error message |
| No Copilot sign-in | Step 7 shows "No GitHub Copilot model available" with a Retry button |
| Bad OpenAI key | Step 7 shows the backend error with a Retry button |
| First run with no `.venv` | Progress notification while the venv is created and packages install; status bar reaches "Ready" |
