FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
COPY webterm /usr/local/bin/webterm
COPY config.yaml /config.yaml
EXPOSE 8888
ENTRYPOINT ["webterm", "-config", "/config.yaml"]
