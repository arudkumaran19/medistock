FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY global.json ./
COPY backend/src/MediStock.Api/MediStock.Api.csproj backend/src/MediStock.Api/
RUN dotnet restore backend/src/MediStock.Api/MediStock.Api.csproj

# Copy source code and publish
COPY backend/src/MediStock.Api/ backend/src/MediStock.Api/
WORKDIR /src/backend/src/MediStock.Api
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5050
EXPOSE 5050
ENTRYPOINT ["dotnet", "MediStock.Api.dll"]
