#!/bin/sh

set -u

executable='zap-browser'
action="${1:-}"

# RPM passes 0 for a final erase and a positive value during upgrades. Debian
# passes "remove"/"purge" for uninstall and "upgrade" during replacement.
case "$action" in
    0|remove|purge)
        if command -v update-alternatives >/dev/null 2>&1; then
            update-alternatives --remove "$executable" "/opt/Zap-Browser/$executable" || true
        else
            rm -f "/usr/bin/$executable"
        fi
        ;;
esac

if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

exit 0
