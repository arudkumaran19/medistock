using MediStock.Api.Features.Inventory.DTOs;
using MediStock.Api.Features.Inventory.Models;
using MediStock.Api.Features.Inventory.Services;
using MediStock.Api.Features.Inventory.Validators;
using MediStock.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace MediStock.Api.Tests;

public sealed class MedicineValidationTests
{
    private static MedicineService CreateMedicineService() => new(new ApplicationDbContext(
        new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options));

    private static Task<MedicineResponse> CreateMedicine(string? code = "PARA-500", string? name = "Paracetamol 500 mg", string? unit = "tablet", int? minimum = 0) =>
        CreateMedicineService().CreateAsync(new CreateMedicineRequest(code, name, unit, minimum), default);

    [Theory]
    [InlineData("PARA-500")]
    [InlineData("AMOX-250")]
    [InlineData("VITC-001")]
    [InlineData("IBU-200")]
    public async Task Medicine_code_accepts_the_supported_format(string code)
    {
        var result = await CreateMedicine(code);
        Assert.Equal(code, result.Code);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("PARA 500")]
    [InlineData("PARA@500")]
    [InlineData("PARA500")]
    [InlineData("PARA-50")]
    [InlineData("PARA-5000")]
    [InlineData("---")]
    [InlineData("@@@")]
    [InlineData("-PARA500")]
    [InlineData("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy")]
    public async Task Medicine_code_rejects_blank_and_malformed_values(string? code)
    {
        await Assert.ThrowsAsync<InventoryException>(() => CreateMedicine(code));
    }

    [Fact]
    public async Task Medicine_name_is_trimmed_and_required()
    {
        var result = await CreateMedicine(name: "  Vitamin C  ");
        Assert.Equal("Vitamin C", result.Name);
        Assert.Equal("B12", (await CreateMedicine("B12-001", "B12")).Name);
        await Assert.ThrowsAsync<InventoryException>(() => CreateMedicine(name: " "));
    }

    [Fact]
    public async Task Medicine_name_rejects_values_over_model_length()
    {
        await Assert.ThrowsAsync<InventoryException>(() => CreateMedicine(name: new string('A', 201)));
    }

    [Theory]
    [InlineData("tablet")]
    [InlineData("capsule")]
    [InlineData("bottle")]
    [InlineData("vial")]
    [InlineData("box")]
    [InlineData("strip")]
    public async Task Unit_accepts_textual_units_and_trims_them(string unit)
    {
        var result = await CreateMedicine(unit: $" {unit} ");
        Assert.Equal(unit, result.Unit);
    }

    [Theory]
    [InlineData("123")]
    [InlineData("50")]
    [InlineData("3.5")]
    [InlineData("@@@")]
    [InlineData("---")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("abcdefghijklmnopqrstuvwxyz12345")]
    public async Task Unit_rejects_nontext_and_invalid_values(string unit)
    {
        await Assert.ThrowsAsync<InventoryException>(() => CreateMedicine(unit: unit));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(100)]
    public async Task Minimum_stock_accepts_nonnegative_integers(int minimum)
    {
        var result = await CreateMedicine(minimum: minimum);
        Assert.Equal(minimum, result.MinimumStockLevel);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(-5)]
    public async Task Minimum_stock_rejects_negative_values(int minimum)
    {
        await Assert.ThrowsAsync<InventoryException>(() => CreateMedicine(minimum: minimum));
    }

    [Fact]
    public async Task Minimum_stock_is_required()
    {
        await Assert.ThrowsAsync<InventoryException>(() => CreateMedicine(minimum: null));
    }

    [Theory]
    [InlineData("3.5")]
    [InlineData("\"abc\"")]
    public void Minimum_stock_JSON_rejects_decimal_and_text_values(string jsonValue)
    {
        var json = $"{{\"Code\":\"PARA-500\",\"Name\":\"Paracetamol\",\"Unit\":\"tablet\",\"MinimumStockLevel\":{jsonValue}}}";
        Assert.Throws<System.Text.Json.JsonException>(() => System.Text.Json.JsonSerializer.Deserialize<CreateMedicineRequest>(json));
    }

    [Theory]
    [InlineData("BATCH-001")]
    [InlineData("BATCH-002")]
    [InlineData("BATCH-123")]
    public void Batch_number_accepts_supported_values(string batchNumber)
    {
        Assert.Equal(batchNumber, InventoryValidator.ValidateBatchNumber(batchNumber));
    }

    [Theory]
    [InlineData("--ABC 124")]
    [InlineData("-ABC123")]
    [InlineData("ABC 123")]
    [InlineData("ABC345")]
    [InlineData("BATCH-1")]
    [InlineData("BATCH-01")]
    [InlineData("BATCH-1234")]
    [InlineData("BATCH-ABC")]
    [InlineData("batch-001")]
    [InlineData("@@@")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("-1")]
    [InlineData("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxy")]
    public void Batch_number_rejects_blank_placeholder_and_malformed_values(string batchNumber)
    {
        Assert.Throws<InventoryException>(() => InventoryValidator.ValidateBatchNumber(batchNumber));
    }

    [Fact]
    public void Medicine_code_is_not_an_editable_update_field()
    {
        Assert.DoesNotContain(typeof(UpdateMedicineRequest).GetProperties(), property => property.Name == "Code");
    }
}
