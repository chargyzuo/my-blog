---
title: 'BGP Troubleshooting Cheat Sheet'
description: 'The commands and mental model I reach for when a BGP session misbehaves.'
pubDate: 'Aug 05 2026'
category: 'troubleshooting'
---

When a BGP session won't come up, I work through the state machine top-down:
**Idle → Connect → Active → OpenSent → OpenConfirm → Established**. Where it
gets stuck tells you where to look.

## 1. Is the session even up?

```bash
show bgp ipv4 unicast summary
show ip bgp neighbors 10.0.0.1
```

If it's stuck in `Active`, TCP/179 isn't completing — check reachability, ACLs
and `ttl-security`. If it flaps between `OpenSent` and `Idle`, suspect an ASN or
router-id mismatch.

## 2. Are we exchanging routes?

```bash
show ip bgp neighbors 10.0.0.1 advertised-routes
show ip bgp neighbors 10.0.0.1 received-routes
```

No routes received? Check the neighbor's outbound policy. No routes installed?
Look at next-hop reachability and any inbound route-maps.

## 3. Common gotchas

- **Next-hop not reachable** → use `next-hop-self` on iBGP.
- **Missing `network` statement** or redistribution.
- **Prefix-list / route-map** silently dropping everything.
- **MTU mismatch** breaking large updates (ping with DF bit to confirm).

Keep this list handy — 90% of BGP issues fall into one of these buckets.
