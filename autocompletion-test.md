---
applies_to:
  
---

# Autocompletion Test

Test scenarios:

1. **Root level**: Put cursor after the first `---` on a new line and press Ctrl+Space
   - Should suggest: applies_to, description, layout, mapped_pages, navigation_title, products, sub, title

2. **After applies_to:**: Put cursor after `applies_to:` with 2+ spaces indentation and press Ctrl+Space  
   - Should suggest: stack, deployment, serverless, product

3. **After serverless:**: Add `serverless:` under applies_to, then with 4+ spaces press Ctrl+Space
   - Should suggest: elasticsearch, observability, security

4. **After deployment:**: Add `deployment:` under applies_to, then with 4+ spaces press Ctrl+Space
   - Should suggest: self, ece, eck, ess