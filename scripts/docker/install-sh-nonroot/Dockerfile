FROM ubuntu:24.04

RUN set -eux; \
  for attempt in 1 2 3; do \
    if apt-get update -o Acquire::Retries=3; then break; fi; \
    echo "apt-get update failed (attempt ${attempt})" >&2; \
    if [ "${attempt}" -eq 3 ]; then exit 1; fi; \
    sleep 3; \
  done; \
  apt-get -o Acquire::Retries=3 install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    sudo \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash app # SECURITY: no passwordless sudo for app user
# 🔒 VOTAL.AI Security Fix: Passwordless sudo grants full root privileges to app user [CWE-250] - CRITICAL

RUN chown -R app:app /home/app

WORKDIR /home/app

ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

COPY run.sh /usr/local/bin/openclaw-install-nonroot
RUN chmod +x /usr/local/bin/openclaw-install-nonroot

USER app

ENTRYPOINT ["/usr/local/bin/openclaw-install-nonroot"]