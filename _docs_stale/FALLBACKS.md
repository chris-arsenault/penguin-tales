# Fallback Policy

No fallbacks to hide misconfiguration. Review the code you produce for errors. If necessary add a named parameter with default=false to use legacy functionality. Include a warning log that functionality being used is most likely in violation of contract.

## Pattern

**BAD - Silent fallback hides misconfiguration:**
```typescript
const region = mapper.getRegion(id);
if (!region) {
  // Silently fall back - caller never knows config is wrong
  return randomPlacement();
}
```

**GOOD - Fail by default, opt-in fallback:**
```typescript
function place(id: string, options: { enableFallback?: boolean } = {}) {
  const { enableFallback = false } = options;

  const region = mapper.getRegion(id);
  if (!region) {
    if (!enableFallback) {
      throw new Error(`Region '${id}' not configured. Set enableFallback=true to bypass.`);
    }
    console.warn(`FALLBACK (enableFallback=true): Using fallback for '${id}'. Likely contract violation.`);
    return randomPlacement();
  }
  return regionPlacement(region);
}
```

## Key Points

1. Default behavior should **fail loudly** when config is missing
2. Fallback requires **explicit opt-in** via named parameter (default=false)
3. When fallback is used, **log a warning** that it's likely a contract violation
