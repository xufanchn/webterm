.PHONY: build dev clean

VERSION ?= dev

build:
	cd ui && npm run build
	go build -ldflags "-X main.version=$(VERSION)" -o webterm .

dev:
	go run . -config config.yaml

dev-ui:
	cd ui && npm run dev

clean:
	rm -f webterm webterm.db
	rm -rf frontend/dist
