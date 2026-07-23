FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-bookworm-slim

LABEL org.opencontainers.image.source="https://github.com/minerport/VynodeArr-Unified" \
      org.opencontainers.image.title="VynodeArr" \
      org.opencontainers.image.description="Unified movie and television media manager"

ARG VYNODEARR_UID=1000
ARG VYNODEARR_GID=1000

RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates curl libicu72 libmediainfo0v5 libssl3 sqlite3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "${VYNODEARR_GID}" vynodearr \
    && useradd --uid "${VYNODEARR_UID}" --gid "${VYNODEARR_GID}" --home-dir /config --no-create-home --shell /usr/sbin/nologin vynodearr

WORKDIR /opt/vynodearr
COPY . /opt/vynodearr

RUN chmod +x \
      /opt/vynodearr/gateway/VynodeArr.Gateway \
      /opt/vynodearr/engines/movie/Radarr \
      /opt/vynodearr/engines/movie/ffprobe \
      /opt/vynodearr/engines/television/Sonarr \
      /opt/vynodearr/engines/television/ffprobe \
    && mkdir -p /config/movie /config/television /config/unified \
    && chown -R vynodearr:vynodearr /config

ENV ASPNETCORE_URLS=http://0.0.0.0:8686 \
    HOME=/config \
    VynodeArr__DataRoot=/config \
    VynodeArr__Engines__Movie__Enabled=true \
    VynodeArr__Engines__Movie__ExecutablePath=/opt/vynodearr/engines/movie/Radarr \
    VynodeArr__Engines__Movie__Arguments="-nobrowser -data={data}" \
    VynodeArr__Engines__Television__Enabled=true \
    VynodeArr__Engines__Television__ExecutablePath=/opt/vynodearr/engines/television/Sonarr \
    VynodeArr__Engines__Television__Arguments="-nobrowser -data={data}" \
    DOTNET_RUNNING_IN_CONTAINER=true

VOLUME ["/config"]
EXPOSE 8686
USER vynodearr
WORKDIR /opt/vynodearr/gateway

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD ["curl", "--fail", "--silent", "http://127.0.0.1:8686/health"]

ENTRYPOINT ["/opt/vynodearr/gateway/VynodeArr.Gateway"]
