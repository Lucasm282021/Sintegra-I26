# Servicios simulados SOLO para la demo local del TPV (no se integran al ecosistema).
# Se construye desde la carpeta de Brisa:  docker build -f herramientas/Simuladores/Dockerfile .

FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY herramientas/Simuladores/Simuladores.csproj herramientas/Simuladores/packages.lock.json herramientas/Simuladores/
RUN dotnet restore herramientas/Simuladores/Simuladores.csproj --locked-mode
COPY herramientas/Simuladores/ herramientas/Simuladores/
RUN dotnet publish herramientas/Simuladores/Simuladores.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
WORKDIR /app
COPY --from=build /app .
ENV DOTNET_gcServer=0
USER $APP_UID
EXPOSE 3002 3003 3004 3005 3006
ENTRYPOINT ["dotnet", "Simuladores.dll"]
