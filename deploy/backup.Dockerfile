FROM restic/restic:0.18.0 AS restic

FROM postgres:17.9-alpine
RUN apk add --no-cache ca-certificates jq openssh-client \
    && addgroup -g 1000 backup \
    && adduser -D -u 1000 -G backup backup
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY --chmod=0555 scripts/backup.sh /usr/local/bin/blog-backup
COPY --chmod=0555 scripts/restore.sh /usr/local/bin/blog-restore
COPY --chmod=0555 scripts/restic-maintenance.sh /usr/local/bin/restic-maintenance
ENV HOME=/home/backup
ENV RESTIC_CACHE_DIR=/tmp/restic-cache
USER backup
ENTRYPOINT ["/usr/local/bin/blog-backup"]
