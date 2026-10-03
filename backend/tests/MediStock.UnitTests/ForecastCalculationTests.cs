namespace MediStock.UnitTests;

using FluentAssertions;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using Xunit;

/// <summary>
/// Required individual testing evidence for the Demand &amp; Shortage vertical:
/// forecast calculations. Sathurstiga S. (IT24103156).
///
/// The forecast is deterministic statistics (blueprint section 96), so every expected
/// value below is computed by hand in the comment above the assertion.
/// </summary>
public class ForecastCalculationTests
{
    private static readonly DateTime Today = new(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);

    // -----------------------------------------------------------------------
    // Daily series construction
    // -----------------------------------------------------------------------

    [Fact]
    public void BuildDailySeries_FillsDaysWithoutConsumptionWithZero()
    {
        var history = new[]
        {
            Record(Today.AddDays(-5), 5m),
            Record(Today.AddDays(-1), 10m)
        };

        var series = ForecastService.BuildDailySeries(history, windowDays: 5, today: Today);

        // Window covers the five days before today: -5, -4, -3, -2, -1.
        series.Should().Equal(5m, 0m, 0m, 0m, 10m);
    }

    [Fact]
    public void BuildDailySeries_SumsMultipleRecordsOnTheSameDay()
    {
        var history = new[]
        {
            Record(Today.AddDays(-1), 4m),
            Record(Today.AddDays(-1), 6m)
        };

        var series = ForecastService.BuildDailySeries(history, windowDays: 2, today: Today);

        series.Should().Equal(0m, 10m);
    }

    [Fact]
    public void BuildDailySeries_ExcludesConsumptionOlderThanTheWindow()
    {
        var history = new[]
        {
            Record(Today.AddDays(-10), 999m),
            Record(Today.AddDays(-1), 7m)
        };

        var series = ForecastService.BuildDailySeries(history, windowDays: 3, today: Today);

        series.Should().Equal(0m, 0m, 7m);
        series.Sum().Should().Be(7m);
    }

    [Fact]
    public void BuildDailySeries_WithNonPositiveWindow_IsEmpty()
    {
        ForecastService.BuildDailySeries(Array.Empty<ConsumptionRecord>(), 0, Today).Should().BeEmpty();
    }

    // -----------------------------------------------------------------------
    // Moving average
    // -----------------------------------------------------------------------

    [Fact]
    public void MovingAverage_IsTheUnweightedMean()
    {
        // (10 + 20 + 30) / 3 = 20
        ForecastService.MovingAverage(new[] { 10m, 20m, 30m }).Should().Be(20m);
    }

    [Fact]
    public void MovingAverage_CountsEmptyDaysInTheDivisor()
    {
        // (20 + 0 + 0 + 0) / 4 = 5, not 20. Gaps must pull the average down.
        ForecastService.MovingAverage(new[] { 20m, 0m, 0m, 0m }).Should().Be(5m);
    }

    [Fact]
    public void Calculate_MovingAverage_ReproducesTheBlueprintConsumptionRate()
    {
        // 30 days at 20 units a day is the seeded demonstration dataset.
        var series = Enumerable.Repeat(20m, 30).ToList();

        var result = ForecastService.Calculate(series, horizonDays: 30, ForecastMethods.MovingAverage);

        result.AverageDailyConsumption.Should().Be(20m);
        // 20/day across a 30 day horizon.
        result.PredictedDemand.Should().Be(600m);
        result.Method.Should().Be(ForecastMethods.MovingAverage);
    }

    // -----------------------------------------------------------------------
    // Weighted moving average
    // -----------------------------------------------------------------------

    [Fact]
    public void WeightedMovingAverage_WeightsRecentDaysMoreHeavily()
    {
        // weights 1,2,3 => (10*1 + 20*2 + 30*3) / (1+2+3) = 140/6 = 23.3333...
        var result = ForecastService.WeightedMovingAverage(new[] { 10m, 20m, 30m });

        result.Should().BeApproximately(23.3333m, 0.0001m);
    }

    [Fact]
    public void WeightedMovingAverage_OnAFlatSeries_EqualsTheMovingAverage()
    {
        var series = Enumerable.Repeat(20m, 30).ToList();

        ForecastService.WeightedMovingAverage(series)
            .Should().Be(ForecastService.MovingAverage(series));
    }

    [Fact]
    public void WeightedMovingAverage_OnARisingSeries_ExceedsTheMovingAverage()
    {
        // Rising usage: the weighted method should react faster than the flat mean.
        var series = new[] { 5m, 10m, 15m, 20m, 25m };

        ForecastService.WeightedMovingAverage(series)
            .Should().BeGreaterThan(ForecastService.MovingAverage(series));
    }

    // -----------------------------------------------------------------------
    // Simple trend
    // -----------------------------------------------------------------------

    [Fact]
    public void TrendAverage_ProjectsAPerfectlyLinearSeries()
    {
        // y = 10 + 2x over x = 0..4. The next three days are x = 5,6,7 => 20,22,24.
        // Mean of the projected horizon = 22.
        var series = new[] { 10m, 12m, 14m, 16m, 18m };

        ForecastService.TrendAverage(series, horizonDays: 3).Should().Be(22m);
    }

    [Fact]
    public void TrendAverage_OnAFlatSeries_EqualsTheLevel()
    {
        var series = Enumerable.Repeat(20m, 10).ToList();

        ForecastService.TrendAverage(series, horizonDays: 5).Should().BeApproximately(20m, 0.0001m);
    }

    [Fact]
    public void TrendAverage_NeverProjectsNegativeConsumption()
    {
        // A steeply falling series would cross zero. Consumption cannot be negative, so
        // the projection floors at zero rather than producing a negative forecast.
        var series = new[] { 50m, 40m, 30m, 20m, 10m };

        var result = ForecastService.TrendAverage(series, horizonDays: 30);

        result.Should().BeGreaterThanOrEqualTo(0m);
    }

    [Fact]
    public void TrendAverage_WithASingleDay_ReturnsThatDay()
    {
        ForecastService.TrendAverage(new[] { 17m }, horizonDays: 5).Should().Be(17m);
    }

    // -----------------------------------------------------------------------
    // Confidence
    // -----------------------------------------------------------------------

    [Fact]
    public void CalculateConfidence_IsFullWhenEveryDayHasData()
    {
        ForecastService.CalculateConfidence(Enumerable.Repeat(20m, 30).ToList()).Should().Be(1m);
    }

    [Fact]
    public void CalculateConfidence_FallsWhenTheHistoryIsSparse()
    {
        // Two of four days carry an observation.
        ForecastService.CalculateConfidence(new[] { 10m, 0m, 10m, 0m }).Should().Be(0.5m);
    }

    [Fact]
    public void CalculateConfidence_IsZeroForAnEmptySeries()
    {
        ForecastService.CalculateConfidence(Array.Empty<decimal>()).Should().Be(0m);
    }

    // -----------------------------------------------------------------------
    // Guard rails
    // -----------------------------------------------------------------------

    [Fact]
    public void Calculate_WithAnUnsupportedMethod_Throws()
    {
        var act = () => ForecastService.Calculate(new[] { 10m }, 7, "NEURAL_NETWORK");

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Calculate_WithANonPositiveHorizon_Throws()
    {
        var act = () => ForecastService.Calculate(new[] { 10m }, 0, ForecastMethods.MovingAverage);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void Calculate_WithNoHistory_ReturnsZeroRatherThanThrowing()
    {
        // A medicine with no recorded consumption must still produce a usable forecast.
        var result = ForecastService.Calculate(Array.Empty<decimal>(), 30, ForecastMethods.MovingAverage);

        result.AverageDailyConsumption.Should().Be(0m);
        result.PredictedDemand.Should().Be(0m);
        result.ConfidenceScore.Should().Be(0m);
    }

    [Fact]
    public void CalculateAverageDailyConsumption_DividesByTheWindowNotTheRowCount()
    {
        // Three rows of 20 across a 30 day window is 60/30 = 2/day, not 20/day.
        ConsumptionService.CalculateAverageDailyConsumption(new[] { 20m, 20m, 20m }, windowDays: 30)
            .Should().Be(2m);
    }

    private static ConsumptionRecord Record(DateTime date, decimal quantity) => new()
    {
        Id = Guid.NewGuid(),
        FacilityId = Guid.NewGuid(),
        MedicineId = Guid.NewGuid(),
        QuantityUsed = quantity,
        ConsumptionDate = date,
        Source = "TEST"
    };
}
