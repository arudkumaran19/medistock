using MediStock.Api.Domain.Rules;

namespace MediStock.UnitTests;

public sealed class ExpiryRuleTests
{
    [Fact]
    public void Validate_ReturnsSuccess_WhenBatchExpiresInFuture()
    {
        var result = ExpiryRule.Validate(
            expiryDate: new DateOnly(2026, 10, 1),
            currentDate: new DateOnly(2026, 9, 23));

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void Validate_ReturnsFailure_WhenBatchExpiresToday()
    {
        var result = ExpiryRule.Validate(
            expiryDate: new DateOnly(2026, 9, 23),
            currentDate: new DateOnly(2026, 9, 23));

        Assert.False(result.IsValid);
        Assert.Equal("EXPIRED_BATCH", result.Code);
        Assert.Equal(
            "Expired batches cannot be transferred.",
            result.Message);
    }

    [Fact]
    public void Validate_ReturnsFailure_WhenBatchExpired()
    {
        var result = ExpiryRule.Validate(
            expiryDate: new DateOnly(2026, 9, 22),
            currentDate: new DateOnly(2026, 9, 23));

        Assert.False(result.IsValid);
        Assert.Equal("EXPIRED_BATCH", result.Code);
    }
}
