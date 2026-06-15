# ChartHedgehog

## Запуск проекта

1. Установить Node.js
2. Клонировать репозиторий
3. Перейти в директорию проекта:

```bash
cd lk_student
```

4. Установить зависимости:

```bash
npm install
```

5. Запустить проект:

```bash
npm run dev
```

6. Открыть в браузере: [http://localhost:3000](http://localhost:3000)

## Scripts

```bash
npm run dev      # запуск
npm run build    # production build
npm run lint     # линтер
npm run format   # prettier
```

## SAST

```bash
pip install semgrep

cd C:\Users\matyu\Desktop\ChartHedgehog
semgrep scan `
  --config p/java `
  --config p/secrets `
  --config p/owasp-top-ten `
  --config .github/semgrep/backend-rules.yml `
  backend/src

semgrep scan `
  --config p/react `
  --config p/typescript `
  --config p/secrets `
  --config p/owasp-top-ten `
  --config .github/semgrep/frontend-rules.yml `
  chart_hedgehog/src
  ```

## DAST

```bash
cd backend
mvn -B package -DskipTests
java -jar target/*.jar \
  --spring.datasource.url=jdbc:h2:mem:testdb \
  --spring.datasource.driver-class-name=org.h2.Driver \
  --spring.jpa.database-platform=org.hibernate.dialect.H2Dialect

cd chart_hedgehog
npm run build && npm start

docker run --rm --network=host \
  -v "$(pwd)/.github/zap:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
    -t http://localhost:8080 \
    -c /zap/wrk/zap-rules.tsv \
    -a -j \
    -r report_backend.html \
    -J report_backend.json

docker run --rm --network=host \
  -v "$(pwd)/.github/zap:/zap/wrk" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
    -t http://localhost:3000 \
    -c /zap/wrk/zap-rules.tsv \
    -a -j \
    -r report_frontend.html \
    -J report_frontend.json
  ```

## Dependency Check

```bash
cd C:\Users\matyu\Desktop\ChartHedgehog\backend
mvn dependency-check:check

cd C:\Users\matyu\Desktop\ChartHedgehog\chart_hedgehog
npm audit
  ```
