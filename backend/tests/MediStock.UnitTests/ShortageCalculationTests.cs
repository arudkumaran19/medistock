namespace MediStock.UnitTests;

using FluentAssertions;
using MediStock.Api.Features.Demand.Models;
using MediStock.Api.Features.Demand.Services;
using Xunit;

/// <summary>
/// Required individual testing evidence for the Demand &amp; Shortage vertical:
/// shortage calculations. Sathurstiga S. (IT24103156).
///
/// These cover the projected stockout and shortage risk stages of the chain:
/// consumption -&gt; forecast -&gt; projected stockout -&gt; shortage alert.
/// </summary>
public class ShortageCalculationTests
{
    private static readonly DateTime Today = new(2026, 9, 21, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>
    /// The blueprint's worked example, reproduced exactly:
    ///
    ///   Stock = 120, average consumption = 20/day  =&gt;  days remaining = 6
    ///   Lead time = 10 days,  6 &lt; 10               =&gt;  SHORTAGE RISK
    /// </summary>
    [Fact]
    public void Calculate_BlueprintWorkedExample_ProducesShortageRisk()
    {
        var result = ShortageService.Calculate(
            currentStock: 120m,
            averageDailyConsumption: 20m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().Be(6);
        result.RiskLevel.Should().Be(ShortageRiskLevels.High);
        result.RequiresTransfer.Should().BeTrue();
        result.ProjectedStockoutDate.Should().Be(Today.AddDays(6));
    }

    [Fact]
    public void Calculate_WhenStockOutlastsLeadTime_IsNotAShortage()
    {
        // 400 units at 20/day lasts 20 days, comfortably beyond a 10 day lead time.
        var result = ShortageService.Calculate(
            currentStock: 400m,
            averageDailyConsumption: 20m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().Be(20);
        result.RiskLevel.Should().Be(ShortageRiskLevels.Medium);
        result.RequiresTransfer.Should().BeFalse();
    }

    [Fact]
    public void Calculate_WhenDaysRemainingEqualsLeadTime_IsNotAShortage()
    {
        // The rule is strictly "days remaining < lead time", so equality is the boundary
        // and must not raise an alert.
        var result = ShortageService.Calculate(
            currentStock: 200m,
            averageDailyConsumption: 20m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().Be(10);
        result.RequiresTransfer.Should().BeFalse();
        result.RiskLevel.Should().Be(ShortageRiskLevels.Medium);
    }

    [Fact]
    public void Calculate_WhenOneDayShortOfLeadTime_IsAShortage()
    {
        var result = ShortageService.Calculate(
            currentStock: 180m,
            averageDailyConsumption: 20m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().Be(9);
        result.RequiresTransfer.Should().BeTrue();
        result.RiskLevel.Should().Be(ShortageRiskLevels.High);
    }

    [Fact]
    public void Calculate_RoundsDaysRemainingDown()
    {
        // 125 / 20 = 6.25 days. Six whole days of cover, not seven: rounding up would
        // understate the risk.
        var result = ShortageService.Calculate(
            currentStock: 125m,
            averageDailyConsumption: 20m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().Be(6);
    }

    [Fact]
    public void Calculate_WithNoConsumption_ProjectsNoStockout()
    {
        // Nothing is being used, so stock never runs out. Reporting zero days here
        // would raise a false shortage on every dormant medicine.
        var result = ShortageService.Calculate(
            currentStock: 500m,
            averageDailyConsumption: 0m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().BeNull();
        result.ProjectedStockoutDate.Should().BeNull();
        result.RequiresTransfer.Should().BeFalse();
        result.RiskLevel.Should().Be(ShortageRiskLevels.Medium);
    }

    [Fact]
    public void Calculate_WithZeroStock_ProjectsStockoutToday()
    {
        var result = ShortageService.Calculate(
            currentStock: 0m,
            averageDailyConsumption: 20m,
            leadTimeDays: 10,
            today: Today);

        result.DaysRemaining.Should().Be(0);
        result.ProjectedStockoutDate.Should().Be(Today);
        result.RequiresTransfer.Should().BeTrue();
        result.RiskLevel.Should().Be(ShortageRiskLevels.High);
    }

    [Fact]
    public void Calculate_WithZeroLeadTime_NeverRequiresTransfer()
    {
        // Instant replenishment means stock can never run out before it is replaced.
        var result = ShortageService.Calculate(
            currentStock: 10m,
            averageDailyConsumption: 20m,
            leadTimeDays: 0,
            today: Today);

        result.DaysRemaining.Should().Be(0);
        result.RequiresTransfer.Should().BeFalse();
    }

    [Theory]
    [InlineData(-1, 20, 10)]
    [InlineData(120, -1, 10)]
    [InlineData(120, 20, -1)]
    public void Calculate_WithNegativeInput_Throws(decimal stock, decimal consumption, int leadTime)
    {
        var act = () => ShortageService.Calculate(stock, consumption, leadTime, Today);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void Calculate_ProjectedStockoutDateIsUtc()
    {
        // Dates cross the API as ISO 8601 and are stored as UTC, so the projection must
        // not leak an unspecified kind.
        var result = ShortageService.Calculate(120m, 20m, 10, Today);

        result.ProjectedStockoutDate!.Value.Kind.Should().Be(DateTimeKind.Utc);
    }
}
