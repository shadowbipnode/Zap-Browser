#!/bin/sh

set -u

install_dir='/opt/Zap-Browser'
legacy_install_dir='/opt/Zap Browser'
executable='zap-browser'

if command -v update-alternatives >/dev/null 2>&1; then
    if [ -L "/usr/bin/$executable" ] &&
        [ -e "/usr/bin/$executable" ] &&
        [ "$(readlink "/usr/bin/$executable")" != "/etc/alternatives/$executable" ]; then
        rm -f "/usr/bin/$executable"
    fi
    update-alternatives --install "/usr/bin/$executable" "$executable" "$install_dir/$executable" 100 ||
        ln -sf "$install_dir/$executable" "/usr/bin/$executable"
else
    ln -sf "$install_dir/$executable" "/usr/bin/$executable"
fi

chmod 4755 "$install_dir/chrome-sandbox" 2>/dev/null || true

# Old packages used a product name containing a space. Remove only a directory
# that still looks like that legacy application install; Electron user data is
# stored outside /opt and is never touched here.
if [ -d "$legacy_install_dir" ] &&
    [ ! -L "$legacy_install_dir" ] &&
    [ -x "$legacy_install_dir/$executable" ]; then
    rm -rf -- "$legacy_install_dir" || true
fi

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
