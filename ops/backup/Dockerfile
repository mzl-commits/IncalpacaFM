FROM postgres:17-alpine

RUN apk add --no-cache bash coreutils rclone tzdata

COPY ops/backup/backup.sh /usr/local/bin/incalpaca-backup
COPY ops/backup/entrypoint.sh /usr/local/bin/incalpaca-backup-entrypoint
RUN chmod 0755 /usr/local/bin/incalpaca-backup /usr/local/bin/incalpaca-backup-entrypoint

ENTRYPOINT ["/usr/local/bin/incalpaca-backup-entrypoint"]
