FROM postgres:17-alpine

RUN apk add --no-cache bash coreutils rclone tzdata

COPY ops/backup/backup.sh /usr/local/bin/incalpaca-backup
COPY ops/backup/entrypoint.sh /usr/local/bin/incalpaca-backup-entrypoint
# Git checkouts on Windows may preserve CRLF line endings. Normalize the
# copied shell scripts so their shebangs work inside the Alpine container.
RUN sed -i 's/\r$//' /usr/local/bin/incalpaca-backup /usr/local/bin/incalpaca-backup-entrypoint \
    && chmod 0755 /usr/local/bin/incalpaca-backup /usr/local/bin/incalpaca-backup-entrypoint

ENTRYPOINT ["/usr/local/bin/incalpaca-backup-entrypoint"]
