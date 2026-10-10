using System;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using Xunit;
using MediStock.Api.Common;
using MediStock.Api.Domain.Entities;
using MediStock.Api.Features.Redistribution.Services;

namespace MediStock.Api.Tests;

public class RoutingServiceTests
{
    private readonly Facility _colomboFacility = new()
    {
        Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"),
        Name = "National Hospital of Sri Lanka",
        FacilityCode = "FAC-COL-01",
        Latitude = 6.9175,
        Longitude = 79.8653
    };

    private readonly Facility _galleFacility = new()
    {
        Id = Guid.Parse("a0000000-0000-0000-0000-000000000002"),
        Name = "Teaching Hospital Karapitiya",
        FacilityCode = "FAC-GAL-02",
        Latitude = 6.0682,
        Longitude = 80.2217
    };

    [Fact]
    public async Task GoldenCase_OrsFailure_504Timeout_FallsBackToHaversine_WithoutBlocking()
    {
        // Arrange: Mock HttpClient returning HTTP 504 Gateway Timeout
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.GatewayTimeout,
                Content = new StringContent("Gateway Timeout")
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new[]
            {
                new System.Collections.Generic.KeyValuePair<string, string?>("OpenRouteService:ApiKey", "test-api-key"),
                new System.Collections.Generic.KeyValuePair<string, string?>("OpenRouteService:BaseUrl", "https://api.openrouteservice.org")
            })
            .Build();

        var loggerMock = new Mock<ILogger<RoutingService>>();
        var service = new RoutingService(httpClient, inMemoryConfig, loggerMock.Object);

        // Act: Should never throw, should gracefully fall back to Haversine
        var result = await service.CalculateRouteAsync(_colomboFacility, _galleFacility);

        // Assert: Deterministic Haversine fallback was applied
        result.Should().NotBeNull();
        result.IsFallback.Should().BeTrue();
        result.Provider.Should().Be(Constants.HaversineFallbackProvider);
        result.DistanceKm.Should().BeGreaterThan(100m); // Colombo to Galle is ~120-130km by road
        result.DurationMinutes.Should().BeGreaterThan(120m);
        result.Waypoints.Should().HaveCount(2);
    }

    [Fact]
    public async Task GoldenCase_OrsFailure_429RateLimit_FallsBackToHaversine()
    {
        // Arrange: Mock HttpClient returning HTTP 429 Too Many Requests
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.TooManyRequests,
                Content = new StringContent("Rate Limit Exceeded")
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new[]
            {
                new System.Collections.Generic.KeyValuePair<string, string?>("OpenRouteService:ApiKey", "test-api-key")
            })
            .Build();

        var loggerMock = new Mock<ILogger<RoutingService>>();
        var service = new RoutingService(httpClient, inMemoryConfig, loggerMock.Object);

        // Act
        var result = await service.CalculateRouteAsync(_colomboFacility, _galleFacility);

        // Assert
        result.Should().NotBeNull();
        result.IsFallback.Should().BeTrue();
        result.Provider.Should().Be(Constants.HaversineFallbackProvider);
    }

    [Fact]
    public async Task GoldenCase_OrsFailure_NetworkException_FallsBackToHaversine()
    {
        // Arrange: Mock HttpClient throwing HttpRequestException
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var httpClient = new HttpClient(handlerMock.Object);
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new[]
            {
                new System.Collections.Generic.KeyValuePair<string, string?>("OpenRouteService:ApiKey", "test-api-key")
            })
            .Build();

        var loggerMock = new Mock<ILogger<RoutingService>>();
        var service = new RoutingService(httpClient, inMemoryConfig, loggerMock.Object);

        // Act
        var result = await service.CalculateRouteAsync(_colomboFacility, _galleFacility);

        // Assert
        result.Should().NotBeNull();
        result.IsFallback.Should().BeTrue();
        result.Provider.Should().Be(Constants.HaversineFallbackProvider);
    }

    [Fact]
    public async Task WhenApiKeyMissing_UsesDeterministicHaversineDirectly()
    {
        // Arrange
        var httpClient = new HttpClient();
        var emptyConfig = new ConfigurationBuilder().Build();
        var loggerMock = new Mock<ILogger<RoutingService>>();
        var service = new RoutingService(httpClient, emptyConfig, loggerMock.Object);

        // Act
        var result = await service.CalculateRouteAsync(_colomboFacility, _galleFacility);

        // Assert
        result.Should().NotBeNull();
        result.IsFallback.Should().BeTrue();
        result.Provider.Should().Be(Constants.HaversineFallbackProvider);
        result.DistanceKm.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task WhenOrsSucceeds_ReturnsCalculatedRoute()
    {
        // Arrange: Valid GeoJSON response from OpenRouteService
        var jsonResponse = @"{
            ""features"": [
                {
                    ""properties"": {
                        ""summary"": {
                            ""distance"": 128500.0,
                            ""duration"": 7200.0
                        }
                    },
                    ""geometry"": {
                        ""type"": ""LineString"",
                        ""coordinates"": [
                            [79.8653, 6.9175],
                            [80.2217, 6.0682]
                        ]
                    }
                }
            ]
        }";

        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(jsonResponse, Encoding.UTF8, "application/json")
            });

        var httpClient = new HttpClient(handlerMock.Object);
        var inMemoryConfig = new ConfigurationBuilder()
            .AddInMemoryCollection(new[]
            {
                new System.Collections.Generic.KeyValuePair<string, string?>("OpenRouteService:ApiKey", "valid-key")
            })
            .Build();

        var loggerMock = new Mock<ILogger<RoutingService>>();
        var service = new RoutingService(httpClient, inMemoryConfig, loggerMock.Object);

        // Act
        var result = await service.CalculateRouteAsync(_colomboFacility, _galleFacility);

        // Assert
        result.Should().NotBeNull();
        result.IsFallback.Should().BeFalse();
        result.Provider.Should().Be(Constants.OpenRouteServiceProvider);
        result.DistanceKm.Should().Be(128.50m);
        result.DurationMinutes.Should().Be(120m);
        result.Waypoints.Should().HaveCount(2);
    }
}
