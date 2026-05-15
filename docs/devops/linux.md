# Linux for Backend Engineers

!!! tip "Why Linux Skills Matter"
    Over 90% of production servers run Linux. Backend and infrastructure roles expect you to navigate the filesystem, debug services, analyze logs, manage processes, and write shell scripts — all from the command line. Mastering Linux fundamentals is non-negotiable for any serious backend engineer.

---

## File System Hierarchy

```
/
├── bin/     → Essential user binaries (ls, cp, mv)
├── etc/     → Configuration files (nginx.conf, hosts, passwd)
├── var/     → Variable data (logs, spool, cache)
│   └── log/ → System and application logs
├── home/    → User home directories
├── opt/     → Optional/third-party software
├── tmp/     → Temporary files (cleared on reboot)
├── usr/     → User programs and libraries
├── proc/    → Virtual filesystem for process/kernel info
└── dev/     → Device files (disks, terminals)
```

| Directory | Purpose |
|-----------|---------|
| `/etc` | System-wide configuration files |
| `/var` | Logs, mail, spool — data that changes at runtime |
| `/home` | Per-user home directories |
| `/opt` | Manually installed third-party packages |
| `/tmp` | World-writable temp space, cleared on reboot |

---

## Essential Commands

### File Operations

```bash
ls -lah                        # Long listing, all files, human-readable
cp -r src/ dest/               # Recursive copy
mv old.txt new.txt             # Rename or move
rm -rf /path/to/dir            # Force remove (use with caution!)

find /var/log -name "*.log" -mtime -7        # Logs modified in last 7 days
find . -type f -size +100M                   # Files larger than 100MB
find . -name "*.java" -exec grep -l "TODO" {} \;

chmod 755 script.sh            # rwxr-xr-x
chmod u+x deploy.sh           # Add execute for owner
chown -R appuser:appgroup /opt/app  # Change owner and group recursively
```

### Text Processing

```bash
# grep
grep -r "ERROR" /var/log/           # Recursive search
grep -i "exception" app.log         # Case-insensitive
grep -c "500" access.log            # Count matching lines
grep -A 3 -B 1 "OOM" syslog        # Context around match

# awk
awk '{print $1, $9}' access.log           # Print columns
awk -F: '{print $1}' /etc/passwd          # Custom delimiter
awk '$9 == 500 {count++} END {print count}' access.log

# sed
sed 's/foo/bar/g' file.txt               # Replace all
sed -i 's/DEBUG/INFO/g' config.yml       # In-place edit
sed -n '10,20p' file.txt                 # Print line range

# Pipelines
cut -d: -f1,3 /etc/passwd               # Extract fields
sort access.log | uniq -c | sort -rn | head -10  # Top repeated lines
wc -l /var/log/syslog                    # Count lines
```

### Process Management

```bash
ps aux                          # All processes with details
ps aux | grep java              # Find Java processes
top                             # Live process viewer (press 1 for per-CPU)
htop                            # Interactive process viewer

kill -15 <PID>                  # SIGTERM — graceful stop
kill -9 <PID>                   # SIGKILL — force kill (last resort)
pkill -f "my-app.jar"          # Kill by pattern match

nohup ./long-task.sh &          # Run in background, survives logout
jobs                            # List background jobs
disown %1                       # Detach job from shell
```

### Disk and Memory

```bash
df -h                           # Filesystem usage (human-readable)
df -i                           # Inode usage
du -sh /var/log/*               # Size of each item in /var/log
free -h                         # RAM and swap usage
vmstat 1 5                      # CPU, memory, IO stats every 1s
iostat -x 1                     # Disk I/O stats per device
```

### Networking

```bash
# HTTP requests
curl -v https://api.example.com/health
curl -X POST -H "Content-Type: application/json" -d '{"key":"val"}' URL
wget -q -O- http://localhost:8080/health

# Connections and ports
ss -tlnp                        # TCP listening ports with process names
netstat -tulnp                  # (legacy) Listening ports

# DNS and connectivity
dig +short example.com A        # DNS lookup — just the IP
ping -c 4 google.com            # ICMP echo
traceroute api.internal.com     # Trace network path

# Firewall
iptables -L -n                  # List all rules
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
ufw allow 443/tcp               # UFW shorthand
```

---

## Permissions Deep Dive

### rwx and Octal Notation

```
Permission String:  -rwxr-xr--
                    │└┬┘└┬┘└┬┘
                    │ │   │   └── Others: read only (4)
                    │ │   └────── Group: read + execute (5)
                    │ └────────── Owner: read + write + execute (7)
                    └──────────── File type (- = file, d = dir, l = link)
```

| Octal | Permissions | Octal | Permissions |
|-------|-------------|-------|-------------|
| 7 | rwx | 3 | -wx |
| 6 | rw- | 2 | -w- |
| 5 | r-x | 1 | --x |
| 4 | r-- | 0 | --- |

**Common:** `755` (executables/dirs), `644` (regular files), `600` (secrets/keys), `777` (never in production)

### Special Permissions

| Permission | Octal | On File | On Directory |
|------------|-------|---------|--------------|
| **SUID** | 4000 | Runs as file owner (e.g., `/usr/bin/passwd`) | — |
| **SGID** | 2000 | Runs as file group | New files inherit directory's group |
| **Sticky Bit** | 1000 | — | Only file owner can delete their files (e.g., `/tmp`) |

```bash
chmod 4755 /usr/local/bin/myutil    # Set SUID
chmod 2775 /opt/shared/             # Set SGID on directory
chmod 1777 /tmp                     # Set sticky bit
find / -perm -4000 -type f 2>/dev/null  # Find all SUID files (security audit)
```

---

## Shell Scripting Basics

### Variables and Strings

```bash
#!/bin/bash
APP_NAME="my-service"
VERSION=$(cat VERSION)          # Command substitution
PORT=${PORT:-8080}              # Default value if unset
echo "Deploying ${APP_NAME} v${VERSION} on port ${PORT}"
```

### Conditionals

```bash
if [ -f /etc/nginx/nginx.conf ]; then
    echo "Nginx config exists"
elif [ -d /etc/apache2 ]; then
    echo "Apache is installed"
fi

# String/numeric comparisons
[ "$STATUS" = "healthy" ] && [ "$RETRIES" -lt 3 ] && echo "Service is up"

# Check command exit code
if curl -sf http://localhost:8080/health > /dev/null; then
    echo "OK"
else
    echo "FAILED" >&2; exit 1
fi
```

### Loops

```bash
# For loop
for host in web1 web2 web3; do
    ssh "$host" "sudo systemctl restart app"
done

# While loop — retry pattern
RETRIES=0
until curl -sf http://localhost:8080/health; do
    RETRIES=$((RETRIES + 1))
    [ "$RETRIES" -ge 5 ] && echo "Failed after 5 attempts" && exit 1
    sleep 2
done

# Read file line by line
while IFS= read -r line; do
    echo "Processing: $line"
done < servers.txt
```

### Functions

```bash
#!/bin/bash
log() {
    local level="$1"; shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
}

check_disk_usage() {
    local threshold="${1:-80}"
    local usage=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
    [ "$usage" -gt "$threshold" ] && return 1
    return 0
}

log "INFO" "Starting health check"
check_disk_usage 90 || log "ERROR" "Disk check failed"
```

---

## systemd — Service Management

### Common Commands

```bash
systemctl start|stop|restart|reload nginx
systemctl status nginx           # Current state + recent logs
systemctl enable nginx           # Start on boot
systemctl disable nginx          # Don't start on boot
systemctl is-active nginx        # Quick active check
systemctl list-units --type=service --state=running
systemctl list-units --failed    # Show failed units
```

### Unit File Example

```ini
# /etc/systemd/system/my-app.service
[Unit]
Description=My Java Application
After=network.target postgresql.service

[Service]
Type=simple
User=appuser
WorkingDirectory=/opt/my-app
ExecStart=/usr/bin/java -jar my-app.jar
Restart=on-failure
RestartSec=10
Environment=JAVA_OPTS=-Xmx512m

[Install]
WantedBy=multi-user.target
```

After editing: `systemctl daemon-reload && systemctl restart my-app`

### journalctl — Log Analysis

```bash
journalctl -u nginx --since "1 hour ago"   # Recent logs for a unit
journalctl -u my-app -f          # Follow logs (like tail -f)
journalctl -p err -b             # Only errors since last boot
journalctl --disk-usage          # Journal disk consumption
```

---

## Key Configuration Files

### /etc/hosts

```
127.0.0.1   localhost
10.0.1.50   db-primary.internal  db-primary
10.0.2.10   redis.internal
```

Local DNS override — useful for dev and internal service resolution.

### /etc/passwd

Format: `username:password:UID:GID:comment:home:shell`

```
root:x:0:0:root:/root:/bin/bash
appuser:x:1001:1001:App User:/home/appuser:/bin/bash
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
```

### /etc/fstab

```
# <device>      <mount>  <type>  <options>          <dump> <pass>
UUID=abc-123    /        ext4    errors=remount-ro   0      1
/dev/sdb1       /data    xfs     defaults,noatime    0      2
```

Defines filesystem mounts applied at boot.

### Crontab

```bash
# Format: minute hour day-of-month month day-of-week command
# ┌─ min  ┌─ hour  ┌─ dom  ┌─ month  ┌─ dow
  *        *        *       *         *       command

# Examples
0 2 * * *     /opt/scripts/backup.sh          # Daily at 2 AM
*/5 * * * *   /opt/scripts/health-check.sh    # Every 5 minutes
0 0 * * 0     /opt/scripts/weekly-cleanup.sh  # Sunday midnight
```

```bash
crontab -e                      # Edit current user's crontab
crontab -l                      # List cron jobs
```

---

## Troubleshooting Checklist

### High CPU Usage

```bash
top -o %CPU                     # Identify offending process
ps aux --sort=-%cpu | head -10  # Top 10 CPU consumers
strace -p <PID> -c              # System call summary
cat /proc/<PID>/status          # Process details
```

### Disk Full

```bash
df -h                           # Confirm which filesystem is full
df -i                           # Check inode exhaustion
du -sh /* 2>/dev/null | sort -rh | head -10   # Find largest dirs
find /var/log -type f -size +100M -exec ls -lh {} \;
journalctl --disk-usage         # Journal size
> /var/log/large-app.log        # Truncate (don't delete!) open log file
journalctl --vacuum-size=200M   # Shrink journal
```

### Out of Memory (OOM)

```bash
free -h                         # Check memory state
ps aux --sort=-%mem | head -10  # Find memory hogs
dmesg | grep -i "oom\|killed"  # OOM killer history
journalctl -k | grep -i "oom"  # Kernel OOM messages
cat /proc/<PID>/oom_score       # Higher = more likely to be killed
```

### Connection Refused

```bash
systemctl status my-app         # 1. Is the service running?
ss -tlnp | grep <PORT>          # 2. Is it listening?
curl -v http://localhost:<PORT>  # 3. Accessible locally?
iptables -L -n | grep <PORT>    # 4. Firewall blocking?
dig service.internal             # 5. DNS correct?
traceroute <target-host>         # 6. Network path clear?
```

---

## Interview Questions

??? question "What happens when you type `ls -l` and press Enter?"
    1. Shell tokenizes input into command (`ls`) and args (`-l`), searches `$PATH`.
    2. Shell calls `fork()` to create a child process.
    3. Child calls `execve()` to replace itself with the `ls` binary.
    4. `ls` uses `opendir`, `readdir`, `stat` syscalls to read directory entries and metadata.
    5. Output is written to stdout (fd 1), displayed by terminal.
    6. Child exits; parent collects exit status via `wait()` and shows prompt again.

??? question "Explain the difference between a hard link and a soft (symbolic) link."
    **Hard link:** Another directory entry pointing to the same inode. Deleting one doesn't affect the other. Cannot cross filesystems or link directories. `ln file hardlink`.

    **Soft link:** A file containing the path to the target. Dangling if target is deleted. Can cross filesystems and link directories. `ln -s target symlink`.

    Identify: hard links share inode number (`ls -i`); symlinks show `l` and `->` in `ls -l`.

??? question "A Java service is unresponsive. Walk through your Linux troubleshooting approach."
    1. **Process alive?** `ps aux | grep java` or `systemctl status my-app`
    2. **Resources:** `top -p <PID>` — 100% CPU = loop; 0% CPU = deadlock?
    3. **Memory:** `free -h` — is it swapping? `dmesg | grep -i oom`
    4. **FDs:** `ls /proc/<PID>/fd | wc -l` — hit `ulimit -n`?
    5. **Network:** `ss -tlnp | grep <PORT>` — still listening?
    6. **Thread dump:** `jstack <PID>` to find deadlocks/blocked threads
    7. **Logs:** `journalctl -u my-app --since "10 min ago"`
    8. **Disk:** `df -h` — full log partition can freeze the app

??? question "How does the Linux OOM Killer work and how can you influence it?"
    When the kernel exhausts memory and swap, the OOM Killer terminates processes to reclaim memory. It selects victims by `oom_score` (0-1000) based on memory usage and heuristics.

    **Influencing it:**

    - `echo -1000 > /proc/<PID>/oom_score_adj` — protect a process
    - `echo 1000 > /proc/<PID>/oom_score_adj` — kill first
    - Set `OOMScoreAdjust=-900` in systemd unit files
    - Use cgroups memory limits to isolate services
    - Check kills: `dmesg | grep -i "killed process"`

??? question "Explain what happens during the Linux boot process."
    1. **BIOS/UEFI** — hardware init, POST, finds boot device
    2. **Bootloader (GRUB2)** — loads kernel + initramfs into memory
    3. **Kernel** — detects hardware, mounts initramfs as temp root
    4. **initramfs** — loads drivers, finds real root filesystem
    5. **Mount root** — kernel switches to real `/`
    6. **systemd (PID 1)** — first userspace process, reads unit files
    7. **Targets** — brings up services in dependency order
    8. **Login/getty** — system ready

    Use `systemd-analyze blame` for boot time per service.

??? question "How would you securely transfer files between servers and what are the options?"
    - **`scp`** — simple one-off copy: `scp file.tar.gz user@host:/tmp/`
    - **`rsync`** — efficient delta sync: `rsync -avz /data/ user@host:/data/`
    - **`sftp`** — interactive transfer: `sftp user@host`
    - **`ssh + tar`** — streaming: `tar czf - dir/ | ssh host 'tar xzf - -C /opt/'`

    Security: use SSH key auth, disable password in `sshd_config`, restrict with `AllowUsers`, use `fail2ban`.

---

!!! success "Key Takeaways"
    - Start troubleshooting with **observation** before action (`top`, `free`, `df`, `ss`)
    - SIGTERM (15) = graceful, SIGKILL (9) = forced — always try TERM first
    - `rm` on an open file doesn't free space until the process closes it
    - Inode exhaustion (`df -i`) can cause "disk full" even with free space
