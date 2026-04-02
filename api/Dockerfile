FROM dhi.io/golang:1.26-dev AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM dhi.io/alpine-base:3.23
WORKDIR /app
COPY --from=builder /app/server ./server
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
CMD ["./server"]
