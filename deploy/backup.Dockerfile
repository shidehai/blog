FROM restic/restic:0.18.0 AS restic

FROM postgres:17.9-alpine
RUN apk add --no-cache openssh-client \
    && addgroup -g 1000 backup \
    && adduser -D -u 1000 -G backup backup
COPY --from=restic /usr/bin/restic /usr/local/bin/restic
COPY scripts/backup.sh /usr/local/bin/blog-backup
USER backup
ENTRYPOINT ["/usr/local/bin/blog-backup"]
