---
title: 'Automating Config Backups with Python + Netmiko'
description: 'A tiny script that saves you from ever losing a device config again.'
pubDate: 'Aug 01 2026'
---

Manual config backups don't scale. Here's a minimal, dependency-light way to
pull running configs from a fleet of devices and drop them into timestamped
files — perfect for a nightly cron job.

## The script

```python
from datetime import datetime
from netmiko import ConnectHandler

devices = [
    {"device_type": "cisco_ios", "host": "10.0.0.1", "username": "admin", "password": "secret"},
    {"device_type": "arista_eos", "host": "10.0.0.2", "username": "admin", "password": "secret"},
]

stamp = datetime.now().strftime("%Y%m%d")

for dev in devices:
    with ConnectHandler(**dev) as conn:
        hostname = conn.find_prompt().strip("#>")
        config = conn.send_command("show running-config")
        with open(f"backups/{hostname}_{stamp}.cfg", "w") as f:
            f.write(config)
        print(f"[ok] backed up {hostname}")
```

## Make it production-ready

- Move credentials out of the script — use environment variables or a vault.
- Wrap each connection in `try/except` so one dead device doesn't stop the run.
- Commit the `backups/` directory to Git for a free change-history / diff.
- Schedule it with cron: `0 2 * * * /usr/bin/python3 /opt/backup/run.py`.

That last tip — versioning configs in Git — is the single highest-leverage habit
I've picked up. Every change becomes a reviewable diff.
