---
applies_to:
  stack: 
  serverless:
    elasticsearch: 
    observability: 
  deployment:
    ece: 
  product:
    curator: 
    edot_collector: 
---

# Autocompletion Test

Test scenarios:

1. **Root level**: Put cursor after the first `---` on a new line and press Ctrl+Space
   - Should suggest: applies_to, description, layout, mapped_pages, navigation_title, products, sub, title

2. **After applies_to:**: Put cursor after `applies_to:` with 2+ spaces indentation and press Ctrl+Space  
   - Should suggest: stack, deployment, serverless, product

3. **After serverless:**: Put cursor after `serverless:` with 4+ spaces and press Ctrl+Space
   - Should suggest: elasticsearch, observability, security

4. **After deployment:**: Put cursor after `deployment:` with 4+ spaces and press Ctrl+Space
   - Should suggest: self, ece, eck, ess

5. **Lifecycle values**: Put cursor after any field value (like `stack: `, `elasticsearch: `, `curator: `) and press Ctrl+Space
   - Should suggest: all, ga, preview, beta, deprecated, removed, etc.
   - Should also suggest common patterns like: ga 9.0, beta 9.1, preview 1.0.0