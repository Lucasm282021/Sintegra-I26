# TPV de Brisa · ASP.NET Core 8 + SQLite
# Construir desde esta carpeta:  docker build -t tpv-brisa .

FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY src/Tpv.Api/Tpv.Api.csproj src/Tpv.Api/packages.lock.json src/Tpv.Api/
RUN dotnet restore src/Tpv.Api/Tpv.Api.csproj --locked-mode
COPY src/Tpv.Api/ src/Tpv.Api/
RUN dotnet publish src/Tpv.Api/Tpv.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app
COPY --from=build /app .
RUN mkdir -p /app/data && chown -R $APP_UID /app/data

ENV PORT=3001 \
    DB_PATH=/app/data/tpv.db \
    HTTP_TIMEOUT_MS=5000 \
    TIPO_COMPROBANTE=FACTURA_B \
    DOTNET_gcServer=0

USER $APP_UID
EXPOSE 3001
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

ENTRYPOINT ["dotnet", "Tpv.Api.dll"]
