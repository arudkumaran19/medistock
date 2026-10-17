using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MediStock.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeShortageDaysRemainingNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "DaysRemaining",
                table: "ShortageAlerts",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "DaysRemaining",
                table: "ShortageAlerts",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
