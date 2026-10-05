# ASP.NET Core API image for cloud deployment (Render web service, Docker runtime).
# Build context: the backend/ folder.
#
# Configuration comes only from environment variables set on the host:
#   ConnectionStrings__DefaultConnection, Jwt__SigningKey, Jwt__Issuer, Jwt__Audience,
#   AgentService__BaseUrl, AgentService__ServiceToken, CORS_ALLOWED_ORIGINS.
# No .env file is copied into the image.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so the package layer is cached between builds.
COPY src/MediStock.Api/MediStock.Api.csproj src/MediStock.Api/
RUN dotnet restore src/MediStock.Api/MediStock.Api.csproj

COPY src/ src/
RUN dotnet publish src/MediStock.Api/MediStock.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Render supplies the port in $PORT; 8080 is the local default.
CMD ["sh", "-c", "dotnet MediStock.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
