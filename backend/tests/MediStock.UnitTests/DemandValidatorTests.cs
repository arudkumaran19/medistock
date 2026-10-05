namespace MediStock.UnitTests;

using FluentAssertions;
using MediStock.Api.Features.Demand.DTOs;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Validators;
using Xunit;

/// <summary>
/// Validation tests for the Demand &amp; Shortage vertical.
/// Sathurstiga S. (IT24103156).
///
/// Authoritative business validation is deterministic backend code, so these rules
/// apply equally to requests originating from React, Flutter and the agent service.
/// </summary>
public class DemandValidatorTests
{
    private readonly DemandValidator _validator = new();

    // -----------------------------------------------------------------------
    // Consumption
    // -----------------------------------------------------------------------

    [Fact]
    public void ValidateConsumptionRequest_AcceptsAWellFormedRequest()
    {
        var result = _validator.ValidateConsumptionRequest(ValidConsumption());

        result.IsValid.Should().BeTrue();
        result.Code.Should().BeNull();
    }

    [Fact]
    public void ValidateConsumptionRequest_RejectsAnEmptyFacilityId()
    {
        var request = ValidConsumption();
        request.FacilityId = Guid.Empty;

        var result = _validator.ValidateConsumptionRequest(request);

        result.IsValid.Should().BeFalse();
        result.Code.Should().Be(DemandValidator.ValidationErrorCode);
        result.Message.Should().Contain("facilityId");
    }

    [Fact]
    public void ValidateConsumptionRequest_RejectsAnEmptyMedicineId()
    {
        var request = ValidConsumption();
        request.MedicineId = Guid.Empty;

        _validator.ValidateConsumptionRequest(request).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void ValidateConsumptionRequest_RejectsNonPositiveQuantity(decimal quantity)
    {
        var request = ValidConsumption();
        request.QuantityUsed = quantity;

        var result = _validator.ValidateConsumptionRequest(request);

        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("quantityUsed");
    }

    [Fact]
    public void ValidateConsumptionRequest_RejectsAFutureDate()
    {
        // Consumption records what has already been used, so tomorrow is never valid.
        var request = ValidConsumption();
        request.ConsumptionDate = DateTime.UtcNow.AddDays(1);

        var result = _validator.ValidateConsumptionRequest(request);

        result.IsValid.Should().BeFalse();
        result.Message.Should().Contain("future");
    }

    [Fact]
    public void ValidateConsumptionRequest_AcceptsToday()
    {
        var request = ValidConsumption();
        request.ConsumptionDate = DateTime.UtcNow;

        _validator.ValidateConsumptionRequest(request).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateConsumptionRequest_RejectsAMissingSource(string source)
    {
        var request = ValidConsumption();
        request.Source = source;

        _validator.ValidateConsumptionRequest(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void ValidateConsumptionRequest_RejectsAnOverlongSource()
    {
        var request = ValidConsumption();
        request.Source = new string('x', 65);

        _validator.ValidateConsumptionRequest(request).IsValid.Should().BeFalse();
    }

    // -----------------------------------------------------------------------
    // Forecast
    // -----------------------------------------------------------------------

    [Fact]
    public void ValidateForecastRequest_AcceptsAWellFormedRequest()
    {
        _validator.ValidateForecastRequest(ValidForecast()).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(ForecastMethods.MovingAverage)]
    [InlineData(ForecastMethods.WeightedMovingAverage)]
    [InlineData(ForecastMethods.SimpleTrend)]
    public void ValidateForecastRequest_AcceptsEverySanctionedMethod(string method)
    {
        var request = ValidForecast();
        request.Method = method;

        _validator.ValidateForecastRequest(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidateForecastRequest_RejectsAnUnsanctionedMethod()
    {
        var request = ValidForecast();
        request.Method = "ARIMA";

        var result = _validator.ValidateForecastRequest(request);

        result.IsValid.Should().BeFalse();
        result.Code.Should().Be(DemandValidator.UnsupportedMethodCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(DemandValidator.MaxWindowDays + 1)]
    public void ValidateForecastRequest_RejectsAnOutOfRangeWindow(int windowDays)
    {
        var request = ValidForecast();
        request.WindowDays = windowDays;

        _validator.ValidateForecastRequest(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void ValidateForecastRequest_RejectsAnOutOfRangeHorizon()
    {
        var request = ValidForecast();
        request.HorizonDays = 0;

        _validator.ValidateForecastRequest(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void ValidateForecastRequest_RejectsNegativeLeadTime()
    {
        var request = ValidForecast();
        request.LeadTimeDays = -1;

        _validator.ValidateForecastRequest(request).IsValid.Should().BeFalse();
    }

    // -----------------------------------------------------------------------
    // Shortage recalculation
    // -----------------------------------------------------------------------

    [Fact]
    public void ValidateRecalculateRequest_AcceptsAWellFormedRequest()
    {
        _validator.ValidateRecalculateRequest(ValidRecalculate()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidateRecalculateRequest_AcceptsZeroStock()
    {
        // An empty shelf is a legitimate - and urgent - input.
        var request = ValidRecalculate();
        request.CurrentStock = 0m;

        _validator.ValidateRecalculateRequest(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void ValidateRecalculateRequest_RejectsNegativeStock()
    {
        var request = ValidRecalculate();
        request.CurrentStock = -1m;

        _validator.ValidateRecalculateRequest(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void ValidateRecalculateRequest_RejectsNegativeConsumption()
    {
        var request = ValidRecalculate();
        request.AverageDailyConsumption = -1m;

        _validator.ValidateRecalculateRequest(request).IsValid.Should().BeFalse();
    }

    [Fact]
    public void ValidateRecalculateRequest_AllowsOmittedConsumption()
    {
        // Omitted means "derive it from stored history", which is the normal path.
        var request = ValidRecalculate();
        request.AverageDailyConsumption = null;

        _validator.ValidateRecalculateRequest(request).IsValid.Should().BeTrue();
    }

    // -----------------------------------------------------------------------
    // Paging
    // -----------------------------------------------------------------------

    [Theory]
    [InlineData(0, 20, 1, 20)]
    [InlineData(-5, 20, 1, 20)]
    [InlineData(3, 0, 3, 20)]
    [InlineData(2, 500, 2, 100)]
    [InlineData(2, 50, 2, 50)]
    public void NormalisePaging_ClampsToTheFrozenConvention(
        int page,
        int pageSize,
        int expectedPage,
        int expectedPageSize)
    {
        var (normalisedPage, normalisedPageSize) = DemandValidator.NormalisePaging(page, pageSize);

        normalisedPage.Should().Be(expectedPage);
        normalisedPageSize.Should().Be(expectedPageSize);
    }

    private static ConsumptionRequest ValidConsumption() => new()
    {
        FacilityId = Guid.NewGuid(),
        MedicineId = Guid.NewGuid(),
        QuantityUsed = 20m,
        ConsumptionDate = DateTime.UtcNow.AddDays(-1),
        Source = "FLUTTER_CONSUMPTION_ENTRY"
    };

    private static ForecastRequest ValidForecast() => new()
    {
        FacilityId = Guid.NewGuid(),
        MedicineId = Guid.NewGuid(),
        WindowDays = 30,
        HorizonDays = 30,
        Method = ForecastMethods.MovingAverage
    };

    private static ShortageRecalculateRequest ValidRecalculate() => new()
    {
        FacilityId = Guid.NewGuid(),
        MedicineId = Guid.NewGuid(),
        CurrentStock = 120m,
        AverageDailyConsumption = 20m,
        LeadTimeDays = 10,
        WindowDays = 30
    };
}
