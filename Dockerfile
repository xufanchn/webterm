FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
COPY webterm /usr/local/bin/webterm
EXPOSE 8443
ENTRYPOINT ["webterm"]
