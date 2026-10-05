using MediStock.Api.Domain.Rules;

namespace MediStock.UnitTests;

public sealed class MinimumStockRuleTests
{
    [Fact]
    public void Validate_ReturnsSuccess_WhenStockRemainsAboveMinimum()
    {
        var result = MinimumStockRule.Validate(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 200);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }

    [Fact]
    public void Validate_ReturnsFailure_WhenTransferDropsBelowMinimum()
    {
        var result = MinimumStockRule.Validate(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 300);

        Assert.False(result.IsValid);
        Assert.Equal("MINIMUM_STOCK_VIOLATION", result.Code);
        Assert.Equal(
            "Transfer would reduce source stock below its minimum level.",
            result.Message);
    }

    [Fact]
    public void Validate_ReturnsFailure_WhenTransferQuantityIsZero()
    {
        var result = MinimumStockRule.Validate(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 0);

        Assert.False(result.IsValid);
        Assert.Equal("INVALID_TRANSFER_QUANTITY", result.Code);
    }

    [Fact]
    public void Validate_ReturnsFailure_WhenTransferQuantityIsNegative()
    {
        var result = MinimumStockRule.Validate(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: -10);

        Assert.False(result.IsValid);
        Assert.Equal("INVALID_TRANSFER_QUANTITY", result.Code);
    }

    [Fact]
    public void Validate_ReturnsFailure_WhenSourceStockIsNegative()
    {
        var result = MinimumStockRule.Validate(
            sourceStock: -1,
            reservedStock: 0,
            minimumStock: 150,
            transferQuantity: 10);

        Assert.False(result.IsValid);
        Assert.Equal("INVALID_SOURCE_STOCK", result.Code);
    }

    [Fact]
    public void Validate_ReturnsSuccess_WhenStockExactlyEqualsMinimum()
    {
        var result = MinimumStockRule.Validate(
            sourceStock: 500,
            reservedStock: 100,
            minimumStock: 150,
            transferQuantity: 250);

        Assert.True(result.IsValid);
        Assert.Equal("VALID", result.Code);
    }
}