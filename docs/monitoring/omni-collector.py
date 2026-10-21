#!/usr/bin/env python3
"""
Bharat Organic Expo - Infrastructure module - optional read-only server collector (Linux).

What it does: every INTERVAL seconds it reads /proc (CPU, memory, load, disk, network, uptime), the mounted
filesystems and, optionally, container state, then HTTPS-POSTs one small JSON document to your Bharat Organic Expo API
with a per-server bearer token. It listens on NO port, runs no commands received from the network, opens no shell and
needs no root. Nothing is sent that is not in the JSON below.

Not collected: passwords, keys, environment variables, process command lines, file contents.

Usage (run it yourself, only on a server you own):
  OMNI_URL=https://your-api.example.com/api/v1/infrastructure/ingest \
  OMNI_TOKEN=omi_col_xxxxxxxx \
  python3 omni-collector.py            # loops forever (use systemd/cron/tmux)
  python3 omni-collector.py --once     # send one sample and exit (good for a first test)
  python3 omni-collector.py --dry-run  # print the JSON, send nothing

Optional: --docker adds container state via the local `docker` CLI. That requires the running user to be able to
use the Docker socket, which is root-equivalent on that host: prefer a read-only socket proxy, or leave it off.

TLS certificates are always verified. There is deliberately no "insecure" flag.
"""
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

VERSION = "1.0.0"
INTERVAL = max(30, int(os.environ.get("OMNI_INTERVAL", "60")))
PSEUDO_FS = {"proc", "sysfs", "tmpfs", "devtmpfs", "devpts", "cgroup", "cgroup2", "overlay", "squashfs", "autofs", "mqueue",
             "hugetlbfs", "debugfs", "tracefs", "securityfs", "pstore", "bpf", "fusectl", "configfs", "ramfs", "nsfs", "efivarfs"}


def read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return None


def cpu():
    text = read("/proc/stat")
    if not text:
        return None
    parts = text.splitlines()[0].split()[1:]
    names = ["user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal"]
    return {n: int(v) for n, v in zip(names, parts)}


def memory():
    text = read("/proc/meminfo")
    if not text:
        return None
    info = {}
    for line in text.splitlines():
        key, _, rest = line.partition(":")
        info[key] = int(rest.split()[0]) * 1024
    return {
        "totalBytes": info.get("MemTotal", 0),
        "availableBytes": info.get("MemAvailable", info.get("MemFree", 0)),
        "cachedBytes": info.get("Cached"),
        "swapTotalBytes": info.get("SwapTotal"),
        "swapFreeBytes": info.get("SwapFree"),
    }


def filesystems():
    out, seen = [], set()
    for line in (read("/proc/mounts") or "").splitlines():
        dev, mount, fstype, opts = (line.split() + ["", "", "", ""])[:4]
        if fstype in PSEUDO_FS or not dev.startswith("/") or mount in seen:
            continue
        seen.add(mount)
        try:
            st = os.statvfs(mount)
        except OSError:
            continue
        total = st.f_blocks * st.f_frsize
        if total <= 0:
            continue
        used = (st.f_blocks - st.f_bfree) * st.f_frsize
        item = {"mount": mount, "fstype": fstype, "totalBytes": total, "usedBytes": used, "readOnly": "ro" in opts.split(",")}
        if st.f_files:
            item["inodesTotal"] = st.f_files
            item["inodesUsed"] = st.f_files - st.f_ffree
        out.append(item)
    return out[:32]


def diskio():
    read_b = write_b = 0
    for line in (read("/proc/diskstats") or "").splitlines():
        p = line.split()
        if len(p) < 10:
            continue
        name = p[2]
        # whole disks only (sda, vda, nvme0n1, xvda): partitions would double-count
        if name.startswith(("loop", "ram", "dm-", "sr", "md")):
            continue
        if name[-1].isdigit() and not (name.startswith("nvme") and "p" not in name.split("n")[-1]):
            continue
        read_b += int(p[5]) * 512
        write_b += int(p[9]) * 512
    return {"readBytes": read_b, "writeBytes": write_b}


def network():
    rx = tx = errs_r = errs_t = drop_r = drop_t = 0
    for line in (read("/proc/net/dev") or "").splitlines()[2:]:
        name, _, rest = line.partition(":")
        name = name.strip()
        if name == "lo" or name.startswith(("veth", "docker", "br-", "virbr")):
            continue
        f = rest.split()
        if len(f) < 16:
            continue
        rx += int(f[0]); errs_r += int(f[2]); drop_r += int(f[3])
        tx += int(f[8]); errs_t += int(f[10]); drop_t += int(f[11])
    return {"rxBytes": rx, "txBytes": tx, "rxErrors": errs_r, "txErrors": errs_t, "rxDrops": drop_r, "txDrops": drop_t}


def host():
    os_name = None
    for line in (read("/etc/os-release") or "").splitlines():
        if line.startswith("PRETTY_NAME="):
            os_name = line.split("=", 1)[1].strip().strip('"')
    uptime = float((read("/proc/uptime") or "0 0").split()[0])
    return {
        "hostname": socket.gethostname(), "os": os_name or platform.system(), "kernel": platform.release(), "arch": platform.machine(),
        "bootTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - uptime)), "cpuCores": os.cpu_count(),
    }, int(uptime)


def listening_ports():
    ports = set()
    for path, proto in (("/proc/net/tcp", "tcp"), ("/proc/net/tcp6", "tcp")):
        for line in (read(path) or "").splitlines()[1:]:
            f = line.split()
            if len(f) > 3 and f[3] == "0A":  # LISTEN
                ports.add((int(f[1].rsplit(":", 1)[1], 16), proto))
    return [{"port": p, "proto": pr} for p, pr in sorted(ports)][:100]


def containers():
    if not shutil.which("docker"):
        return []
    try:
        ps = subprocess.run(["docker", "ps", "-a", "--no-trunc", "--format", "{{json .}}"], capture_output=True, text=True, timeout=15, check=True)
        stats = subprocess.run(["docker", "stats", "--no-stream", "--format", "{{json .}}"], capture_output=True, text=True, timeout=30)
    except Exception:  # noqa: BLE001 - optional feature must never break the collector
        return []
    usage = {}
    for line in stats.stdout.splitlines():
        try:
            s = json.loads(line)
            usage[s["ID"]] = float(str(s.get("CPUPerc", "0")).rstrip("%") or 0)
        except Exception:  # noqa: BLE001
            continue
    out = []
    for line in ps.stdout.splitlines():
        try:
            c = json.loads(line)
        except ValueError:
            continue
        cid = c.get("ID", "")
        out.append({"id": cid[:12], "name": c.get("Names", ""), "image": c.get("Image", ""), "state": c.get("State", "unknown"),
                    "status": c.get("Status"), "cpuPct": usage.get(cid[:12])})
    return out[:200]


def sample(with_docker):
    h, uptime = host()
    load = None
    try:
        load = [float(x) for x in (read("/proc/loadavg") or "").split()[:3]]
    except ValueError:
        pass
    body = {
        "v": 1, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "agentVersion": VERSION, "host": h, "uptimeSec": uptime,
        "cpu": cpu(), "load": load if load and len(load) == 3 else None, "memory": memory(), "filesystems": filesystems(),
        "disk": diskio(), "network": network(),
        "security": {"rebootRequired": os.path.exists("/var/run/reboot-required"), "listeningPorts": listening_ports()},
    }
    if with_docker:
        body["containers"] = containers()
    return {k: v for k, v in body.items() if v is not None}


def post(url, token, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + token, "User-Agent": "omni-collector/" + VERSION, "ngrok-skip-browser-warning": "1"})
    with urllib.request.urlopen(req, timeout=20) as resp:  # certificate verification is on by default
        return resp.status, resp.read().decode()[:300]


def main():
    once, dry, docker = "--once" in sys.argv, "--dry-run" in sys.argv, "--docker" in sys.argv
    url, token = os.environ.get("OMNI_URL", ""), os.environ.get("OMNI_TOKEN", "")
    if dry:
        print(json.dumps(sample(docker), indent=2))
        return 0
    if "--allow-private-http" in sys.argv and url.startswith("http://"):
        # Local testing only: plain HTTP is accepted solely for loopback / RFC1918 hosts.
        import ipaddress
        host = url.split("/")[2].split(":")[0]
        try:
            ok_private = ipaddress.ip_address(host).is_private
        except ValueError:
            ok_private = host == "localhost"
        if not ok_private:
            print("--allow-private-http only works for private/loopback addresses.", file=sys.stderr)
            return 2
    elif not url.startswith("https://"):
        print("Set OMNI_URL (https://...). Plain HTTP is refused.", file=sys.stderr)
        return 2
    if not token.startswith("omi_col_"):
        print("Set OMNI_TOKEN (omi_col_...).", file=sys.stderr)
        return 2
    while True:
        try:
            status, text = post(url, token, sample(docker))
            print(time.strftime("%H:%M:%S"), status, text)
        except urllib.error.HTTPError as e:
            print(time.strftime("%H:%M:%S"), "rejected", e.code, e.read().decode()[:200], file=sys.stderr)
        except Exception as e:  # noqa: BLE001 - keep looping through network blips
            print(time.strftime("%H:%M:%S"), "error", type(e).__name__, file=sys.stderr)
        if once:
            return 0
        time.sleep(INTERVAL)


if __name__ == "__main__":
    sys.exit(main())
