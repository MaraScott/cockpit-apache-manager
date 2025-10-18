Read ../REAME.md for first install
if make fail try 
```
sed -i 's/--no-write-fetch-head//g' Makefile
make
```

```
# mkdir -p /usr/share/cockpit
ln -s `pwd`/dist /usr/share/cockpit/
```

```
sudo makdir -p /usr/local/libexec;
sudo tee /usr/local/libexec/cockpit-apache-helper >/dev/null <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

# Ensure typical admin paths; Cockpit sessions often miss /usr/sbin
export PATH="/usr/sbin:/usr/bin:/sbin:/bin"

SITES_AVAIL="/etc/apache2/sites-available"
SITES_EN="/etc/apache2/sites-enabled"

A2ENSITE="/usr/sbin/a2ensite"
A2DISSITE="/usr/sbin/a2dissite"
APACHECTL="/usr/sbin/apache2ctl"
SYSTEMCTL="/bin/systemctl"

case "${1:-}" in
  list)
    echo "["
    first=1
    shopt -s nullglob
    for f in "$SITES_AVAIL"/*.conf; do
      name="$(basename "$f")"
      enabled=false
      [ -L "$SITES_EN/$name" ] && enabled=true
      entry=$(printf '{"name":"%s","path":"%s","enabled":%s}' "$name" "$f" "$enabled")
      if [ $first -eq 1 ]; then first=0; else printf ",\n"; fi
      printf "%s" "$entry"
    done
    echo "]"
    ;;

  read)
    name="${2:-}"; [[ "$name" =~ ^[A-Za-z0-9._-]+\.conf$ ]] || { echo "Invalid name"; exit 2; }
    cat "$SITES_AVAIL/$name"
    ;;

  write)
    name="${2:-}"; content="${3:-}"; [[ "$name" =~ ^[A-Za-z0-9._-]+\.conf$ ]] || { echo "Invalid name"; exit 2; }
    tmp="$(mktemp)"
    printf "%s" "$content" > "$tmp"
    install -m 0644 "$tmp" "$SITES_AVAIL/$name"
    rm -f "$tmp"
    echo "OK"
    ;;

  enable)
    name="${2:-}"; "$A2ENSITE" "$name" >/dev/null; echo "enabled $name"
    ;;

  disable)
    name="${2:-}"; "$A2DISSITE" "${2:-}" >/dev/null; echo "disabled ${2:-}"
    ;;

  test)
    "$APACHECTL" -t
    ;;

  reload)
    "$SYSTEMCTL" reload apache2
    echo "reloaded"
    ;;

  *)
    echo "Usage: $0 {list|read <name>|write <name> <content>|enable <name>|disable <name>|test|reload}" >&2
    exit 1
    ;;
esac
BASH

sudo chmod 0755 /usr/local/libexec/cockpit-apache-helper
```
```
sudo tee /usr/share/polkit-1/actions/org.marasit.apachehelper.policy >/dev/null <<'BASH'
<?xml version="1.0" encoding="UTF-8"?>
<policyconfig>
  <action id="org.marasit.apachehelper.manage">
    <description>Manage Apache via cockpit-apache-helper</description>
    <message>Authentication is required to manage Apache</message>
    <defaults>
      <allow_any>no</allow_any>
      <allow_inactive>no</allow_inactive>
      <allow_active>auth_admin_keep</allow_active>
    </defaults>
    <annotate key="org.freedesktop.policykit.exec.path">/usr/local/libexec/cockpit-apache-helper</annotate>
  </action>
</policyconfig>
BASH
```
