using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShortageDismissFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DismissReason",
                table: "ShortageAlerts",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DismissedAt",
                table: "ShortageAlerts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "DismissedByUserId",
                table: "ShortageAlerts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ShortageAlerts_Facility_Medicine_DismissedAt",
                table: "ShortageAlerts",
                columns: new[] { "FacilityId", "MedicineId", "DismissedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ShortageAlerts_Facility_Medicine_DismissedAt",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "DismissReason",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "DismissedAt",
                table: "ShortageAlerts");

            migrationBuilder.DropColumn(
                name: "DismissedByUserId",
                table: "ShortageAlerts");
        }
    }
}
