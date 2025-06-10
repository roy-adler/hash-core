# Build stage
FROM node:18-bullseye AS build
WORKDIR /usr/src/app
COPY . .
RUN sh scripts/install-dependencies.sh \
    && yarn ws:core build --copy-index-to-root

# Runtime stage
FROM nginx:alpine
COPY --from=build /usr/src/app/packages/core/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

