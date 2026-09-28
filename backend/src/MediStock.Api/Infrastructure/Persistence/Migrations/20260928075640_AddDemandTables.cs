using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDemandTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConsumptionRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicineId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuantityUsed = table.Column<decimal>(type: "numeric", nullable: false),
                    ConsumptionDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Notes = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsumptionRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DemandForecasts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ForecastDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PredictedDemand = table.Column<decimal>(type: "numeric", nullable: false),
                    AverageDailyConsumption = table.Column<decimal>(type: "numeric", nullable: false),
                    Method = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    WindowDays = table.Column<int>(type: "integer", nullable: false),
                    HorizonDays = table.Column<int>(type: "integer", nullable: false),
                    ConfidenceScore = table.Column<decimal>(type: "numeric(5,4)", precision: 5, scale: 4, nullable: false),
                    LeadTimeDays = table.Column<int>(type: "integer", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemandForecasts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReorderRules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicineId = table.Column<Guid>(type: "uuid", nullable: false),
                    MinimumStock = table.Column<decimal>(type: "numeric", nullable: false),
                    ReorderPoint = table.Column<decimal>(type: "numeric", nullable: false),
                    SafetyStock = table.Column<decimal>(type: "numeric", nullable: false),
                    LeadTimeDays = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReorderRules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShortageAlerts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicineId = table.Column<Guid>(type: "uuid", nullable: false),
                    DemandForecastId = table.Column<Guid>(type: "uuid", nullable: true),
                    CurrentStock = table.Column<decimal>(type: "numeric", nullable: false),
                    AverageDailyConsumption = table.Column<decimal>(type: "numeric", nullable: false),
                    DaysRemaining = table.Column<int>(type: "integer", nullable: false),
                    ProjectedStockoutDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LeadTimeDays = table.Column<int>(type: "integer", nullable: false),
                    RiskLevel = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    RequiresTransfer = table.Column<bool>(type: "boolean", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShortageAlerts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShortageAlerts_DemandForecasts_DemandForecastId",
                        column: x => x.DemandForecastId,
                        principalTable: "DemandForecasts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConsumptionRecords_Facility_Medicine_Date",
                table: "ConsumptionRecords",
                columns: new[] { "FacilityId", "MedicineId", "ConsumptionDate" });

            migrationBuilder.CreateIndex(
                name: "IX_DemandForecasts_Facility_Medicine_GeneratedAt",
                table: "DemandForecasts",
                columns: new[] { "FacilityId", "MedicineId", "GeneratedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ReorderRules_Facility_Medicine",
                table: "ReorderRules",
                columns: new[] { "FacilityId", "MedicineId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortageAlerts_DemandForecastId",
                table: "ShortageAlerts",
                column: "DemandForecastId");

            migrationBuilder.CreateIndex(
                name: "IX_ShortageAlerts_Facility_Status_GeneratedAt",
                table: "ShortageAlerts",
                columns: new[] { "FacilityId", "Status", "GeneratedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ShortageAlerts_RiskLevel",
                table: "ShortageAlerts",
                column: "RiskLevel");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConsumptionRecords");

            migrationBuilder.DropTable(
                name: "ReorderRules");

            migrationBuilder.DropTable(
                name: "ShortageAlerts");

            migrationBuilder.DropTable(
                name: "DemandForecasts");
        }
    }
}
