#!/usr/bin/env node

/**
 * One command to bring up everything the phone needs: the FastAPI backend and
 * the Expo dev server, advertised on a host the device can actually reach.
 *
 *   npm run dev             # backend + Metro (extra args go to `expo start`)
 *   npm run dev -- --web    # e.g. run the web target instead
 *   npm run dev:api         # backend only
 *   npm run dev:mobile      # Metro only
 *
 * The host defaults to this machine's Tailscale IP -- the same choice flake.nix
 * makes for the NixOS dev shell -- and falls back to the LAN address. Devices
 * reach Metro over the tailnet without any firewall change, because Tailscale's
 * own inbound rules cover every program on that interface. Override by setting
 * REACT_NATIVE_PACKAGER_HOSTNAME / EXPO_PUBLIC_API_URL before running.
 */

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

const API_PORT = 8001;
const METRO_PORT = 8081;

const mobileDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(mobileDir, "..", "backend");

const argv = process.argv.slice(2);
const apiOnly = argv.includes("--api-only");
const mobileOnly = argv.includes("--mobile-only");
const expoArgs = ["start", ...argv.filter((a) => a !== "--api-only" && a !== "--mobile-only")];

const log = (msg) => console.log(`[dev] ${msg}`);

// ---------- host detection ----------

function tailscaleCandidates() {
  const fromPath = ["tailscale", "tailscale.exe"];
  if (process.platform === "win32") {
    return [...fromPath, "C:\\Program Files\\Tailscale\\tailscale.exe"];
  }
  if (process.platform === "darwin") {
    return [...fromPath, "/Applications/Tailscale.app/Contents/MacOS/Tailscale"];
  }
  return [...fromPath, "/usr/bin/tailscale", "/usr/local/bin/tailscale"];
}

/** Tailscale IPv4 for this machine, or null when Tailscale isn't usable. */
function tailscaleIp() {
  for (const bin of tailscaleCandidates()) {
    const res = spawnSync(bin, ["ip", "-4"], { encoding: "utf8", timeout: 5000 });
    if (res.error || res.status !== 0) continue;
    const ip = (res.stdout || "").trim().split("\n")[0].trim();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  }
  return null;
}

function lanIp() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs || []) {
      if (addr.family === "IPv4" && !addr.internal) return addr.address;
    }
  }
  return null;
}

// ---------- preflight ----------

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

function venvPython() {
  const rel = process.platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"];
  return path.join(backendDir, ".venv", ...rel);
}

function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  return !res.error && res.status === 0;
}

/** Create backend/.venv on first run so a fresh clone needs one command too. */
function ensureBackendEnv() {
  if (fs.existsSync(venvPython())) return true;
  log("backend/.venv missing -- provisioning with uv");
  const ok =
    run("uv", ["venv", ".venv"], backendDir) &&
    run("uv", ["pip", "install", "--python", ".venv", "-r", "requirements.txt"], backendDir);
  if (!ok) {
    log("could not provision the backend environment. Install uv, then run:");
    log("  cd backend && uv venv .venv && uv pip install --python .venv -r requirements.txt");
    return false;
  }
  return true;
}

// ---------- process supervision ----------

const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null || child.killed) continue;
    // Metro and uvicorn both spawn workers; take down the whole tree.
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}

function start(name, command, args, options) {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  child.on("error", (err) => {
    log(`${name} failed to start: ${err.message}`);
    shutdown(1);
  });
  // Either half dying makes the other useless -- don't leave orphans behind.
  child.on("exit", (code, signal) => {
    log(`${name} exited (${signal || `code ${code}`})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// ---------- main ----------

async function main() {
  const tsIp = tailscaleIp();
  const host = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || tsIp || lanIp();
  if (!host) {
    log("could not determine a host address to advertise. Set REACT_NATIVE_PACKAGER_HOSTNAME.");
    shutdown(1);
    return;
  }
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || `http://${host}:${API_PORT}`;

  if (!mobileOnly && (await portInUse(API_PORT))) {
    log(`port ${API_PORT} is already in use -- stop the existing backend first.`);
    shutdown(1);
    return;
  }
  if (!apiOnly && (await portInUse(METRO_PORT))) {
    log(`port ${METRO_PORT} is already in use -- stop the existing Metro first.`);
    shutdown(1);
    return;
  }

  console.log("");
  log(`host     ${host}${host === tsIp ? " (tailscale)" : ""}`);
  if (!mobileOnly) log(`api      ${apiUrl}`);
  if (!apiOnly) log(`metro    exp://${host}:${METRO_PORT}`);
  console.log("");

  if (!mobileOnly) {
    if (!ensureBackendEnv()) {
      shutdown(1);
      return;
    }
    start("api", venvPython(), ["-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", String(API_PORT)], {
      cwd: backendDir,
    });
  }

  if (!apiOnly) {
    const expoCli = path.join(mobileDir, "node_modules", "expo", "bin", "cli");
    if (!fs.existsSync(expoCli)) {
      log("mobile-app/node_modules is missing -- run `npm install` in mobile-app first.");
      shutdown(1);
      return;
    }
    const expoEnv = {
      ...process.env,
      REACT_NATIVE_PACKAGER_HOSTNAME: host,
      EXPO_PUBLIC_API_URL: apiUrl,
    };
    // An inherited CI redirects Metro into CI mode: no file watching, no
    // reloads, no QR code. That is never what a dev launcher wants.
    if (expoEnv.CI) {
      log(`CI=${expoEnv.CI} is set -- unsetting it for Metro so watch mode and reloads stay on`);
      delete expoEnv.CI;
    }
    start("mobile", process.execPath, [expoCli, ...expoArgs], {
      cwd: mobileDir,
      env: expoEnv,
    });
  }

  if (!apiOnly) {
    console.log("");
    log("open Expo Go on your phone (Tailscale connected) and scan the QR above,");
    log(`or enter ${`exp://${host}:${METRO_PORT}`} manually. Ctrl+C stops both.`);
  }
}

main();
