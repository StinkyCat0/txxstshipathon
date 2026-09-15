{
  description = "React Native (Expo) + Python (uv) dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        # Runtime libs the prebuilt RN DevTools Electron binary needs on NixOS.
        devtoolsLibs = pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux (pkgs.lib.makeLibraryPath (with pkgs; [
          glib nss nspr dbus atk at-spi2-atk cups cairo gtk3 pango
          libX11 libXcomposite libXdamage libXext libXfixes libXrandr
          libxcb libxkbcommon mesa libgbm udev alsa-lib expat
        ]));
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # React Native / Expo
            nodejs_22
            watchman
            jdk17
            # Expo Go needs only Node; native builds also need an Android SDK.

            # Python backend
            python312
            uv

            git
            patchelf # fixes prebuilt RN DevTools binary for NixOS
          ] ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [ pkgs.android-tools ];

          UV_PYTHON_PREFERENCE = "only-system";
          UV_PYTHON_DOWNLOADS = "never";

          shellHook = pkgs.lib.optionalString pkgs.stdenv.hostPlatform.isLinux ''

            # RN DevTools ships a prebuilt Electron binary (via dotslash) that
            # cannot run on NixOS. Patch its ELF interpreter + rpath in place.
            for bin in "$HOME"/.cache/dotslash/*/*/React\ Native\ DevTools-linux-*/"React Native DevTools"; do
              [ -f "$bin" ] || continue
              chmod u+w "$bin" 2>/dev/null || true
              patchelf --set-interpreter "${pkgs.stdenv.cc.bintools.dynamicLinker}" \
                       --set-rpath "$(dirname "$bin"):${devtoolsLibs}" "$bin" 2>/dev/null || true
            done
          '' + ''
            # pillow-heif's native module needs libstdc++ at runtime (NixOS).
            export LD_LIBRARY_PATH="${pkgs.stdenv.cc.cc.lib}/lib''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
          '' + ''
            # Advertise Metro on the Tailscale IP so devices on the tailnet
            # reach it; the app's API client reads EXPO_PUBLIC_API_URL.
            TS_IP="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
            if [ -n "$TS_IP" ]; then
              export REACT_NATIVE_PACKAGER_HOSTNAME="$TS_IP"
              export EXPO_PUBLIC_API_URL="http://$TS_IP:8001"
              echo "tailscale: Metro exp://$TS_IP:8081, API $EXPO_PUBLIC_API_URL"
            fi
            echo "dev shell: node $(node --version), uv $(uv --version)"
          '';
        };
      });
}
