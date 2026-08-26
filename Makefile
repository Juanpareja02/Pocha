.PHONY: server-install server-test server-e2e server-build server-config mobile-check check

server-install:
	cd server && npm install

server-test:
	cd server && npm test

server-build:
	cd server && npm run build

server-e2e:
	cd server && npm run test:e2e

server-config:
	cd server && npm run config:check

mobile-check:
	cd mobile && flutter analyze && flutter test

check: server-test server-e2e server-build server-config mobile-check
