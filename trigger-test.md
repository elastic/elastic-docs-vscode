---
applies_to:
  stack:
  ecctl:
  curator:
  edot_collector:
products:
  - id:
  - id:
---

# Trigger Character Test

**Test these scenarios by typing the colon `:` character:**

## 1. Lifecycle Value Triggers
- Type `stack:` → Should immediately suggest lifecycle states (ga, preview, beta, etc.)
- Type `ecctl:` → Should immediately suggest lifecycle states  
- Type `curator:` → Should immediately suggest lifecycle states
- Type `edot_collector:` → Should immediately suggest lifecycle states

## 2. Product ID Triggers  
- Type `- id:` in products array → Should immediately suggest product IDs
- Type `- id: l` → Should filter to IDs starting with 'l' (like logstash)

## 3. Manual Testing
- Place cursor after any existing `:` and press Ctrl+Space
- Should get the appropriate completions based on field type

The key is that completions should appear **immediately when you type the colon**, not just when you press Ctrl+Space.