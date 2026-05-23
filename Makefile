.PHONY: build dev clean

build:
	cd ui && npm run build
	go build -o webterm .

dev:
	go run . -config config.yaml

dev-ui:
	cd ui && npm run dev

clean:
	rm -f wshell wshell.db
	rm -rf frontend/dist
